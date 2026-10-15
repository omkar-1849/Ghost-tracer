from datetime import datetime, timezone
import logging
from fastapi import HTTPException

from app.config.runtime import get_runtime_config
from app.models.event import Event
from app.models.ai_analysis_job import AiAnalysisJob
from app.models.audit_log import AuditLog
from app.models.incident_evidence import IncidentEvidence
from app.services.alert_service import create_alert
from app.services.ai_analyst_service import (
    analyze_security_event,
    deterministic_analyze_security_event,
)
from app.services.behavior_service import get_attempt_signal, is_auth_failure
from app.services.deduplication_service import fingerprint_from_canonical, find_duplicate_event
from app.services.detection_service import detect_event
from app.services.event_normalizer import normalize_security_event
from app.services.risk_service import calculate_risk
from app.schemas.ai_analyst_schema import AIAnalystInput

logger = logging.getLogger(__name__)


def create_event(db, integration, event_data, audit: bool = True):
    org = db.info.get("organization_id")
    if not org or integration.organization_id != org:
        raise HTTPException(403, "Integration tenant context required")

    client_event_id = getattr(event_data, "event_id", None)

    # 1. Idempotency Pre-Check (scoped to tenant and integration)
    if client_event_id:
        existing = db.query(Event).filter(
            Event.organization_id == org,
            Event.integration_id == integration.id,
            Event.client_event_id == client_event_id,
        ).first()
        if existing is not None:
            setattr(existing, "_is_duplicate", True)
            setattr(existing, "_duplicate_kind", "replay")
            setattr(existing, "_event_id", client_event_id)
            return existing

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    canonical = normalize_security_event({**event_data.model_dump(), "timestamp": now})
    fingerprint = fingerprint_from_canonical(canonical)

    # 2. 60-Second Sliding-Window Fingerprint Suppression
    duplicate = find_duplicate_event(db, integration.website_id, fingerprint, now, integration.id)
    if duplicate is not None:
        setattr(duplicate, "_is_duplicate", True)
        setattr(duplicate, "_duplicate_kind", "suppressed")
        setattr(duplicate, "_event_id", client_event_id)
        return duplicate

    # 3. Deterministic Detection and Risk Scoring
    attempts = get_attempt_signal(
        db,
        integration.website_id,
        canonical.src_ip,
        now,
        is_auth_failure(canonical.event_type, canonical.status_code),
    )
    detection = detect_event(canonical, attempts)
    risk = calculate_risk(
        {
            "event": " ".join(filter(None, [canonical.event_type, canonical.title, canonical.description])),
            "url": canonical.url,
            "status_code": canonical.status_code,
            "user_agent": canonical.user_agent,
        },
        observed_attempts=attempts["attempts"],
    )

    # 4. Off-path AI inference: request path uses deterministic analysis for interim result
    analyst_input = AIAnalystInput(event=canonical.model_dump(mode="json"), detection=detection, risk=risk)
    config = get_runtime_config()
    if config.ai_analyst_enabled:
        # Guarantee no blocking HTTP request on synchronous ingestion path
        analyst = deterministic_analyze_security_event(analyst_input)
    else:
        analyst = analyze_security_event(analyst_input)

    detection.update({
        "canonical_event": canonical.model_dump(mode="json"),
        "risk": risk,
        "provenance": {
            "organization_id": org,
            "integration_id": integration.id,
            "source_ip_trusted": False,
            "attempts": attempts,
            "engine": "deterministic_rules_v1",
        },
    })

    # 5. Evaluate AI Eligibility & Backlog Cap
    ai_status = "NOT_REQUESTED"
    if config.ai_analyst_enabled:
        try:
            min_risk = int(getattr(config, "ai_analyst_min_risk_score", 0))
        except (TypeError, ValueError):
            min_risk = 0
        risk_score = risk.get("risk_score") or 0
        if risk_score >= min_risk:
            try:
                max_pending = int(getattr(config, "ai_queue_max_pending", 5000))
            except (TypeError, ValueError):
                max_pending = 5000
            pending_count = db.query(AiAnalysisJob).filter(
                AiAnalysisJob.status.in_(["PENDING", "RUNNING"])
            ).count()
            if pending_count < max_pending:
                ai_status = "PENDING"
            else:
                ai_status = "SKIPPED"
                logger.warning(
                    "AI analysis skipped for event due to queue saturation (%d >= %d)",
                    pending_count,
                    max_pending,
                )

    from app.services.normalization_service import redact_sensitive_metadata, redact_sensitive_text

    event = Event(
        organization_id=org,
        website_id=integration.website_id,
        integration_id=integration.id,
        client_event_id=client_event_id,
        event_type=canonical.event_type,
        severity=risk["threat_level"].title(),
        source=canonical.source,
        title=canonical.title or "Security event",
        description=redact_sensitive_text(canonical.description),
        ip_address=canonical.src_ip,
        user_agent=canonical.user_agent,
        event_metadata=redact_sensitive_metadata(canonical.metadata),
        fingerprint=fingerprint,
        normalization_version=1,
        created_at=now,
        processed_at=now,
        risk_score=risk["risk_score"],
        threat_level=risk["threat_level"],
        detection_result=detection,
        analyst_result=analyst.model_dump(mode="json"),
        ai_status=ai_status,
        ai_completed_at=None,
    )

    # 6. Insert Event and flush within caller savepoint
    db.add(event)
    db.flush()

    # 7. Atomic AI Analysis Job Enqueue (same savepoint / transaction)
    if ai_status == "PENDING":
        job = AiAnalysisJob(
            organization_id=org,
            event_id=event.id,
            status="PENDING",
            priority=risk.get("risk_score") or 0,
            available_at=now,
        )
        db.add(job)
        db.flush()

    # 8. Alert and Incident Creation (Deterministic; independent of AI)
    if risk["threat_level"] in {"HIGH", "CRITICAL"}:
        message = " | ".join(risk["reasons"]) or "Security indicators require review"
        alert, incident = create_alert(
            db,
            org,
            canonical.src_ip,
            risk["threat_level"],
            message,
            website_id=integration.website_id,
            event_id=event.id,
            detection=detection,
            risk=risk,
            actor_id=db.info.get("actor_id"),
        )
        incident.target = (canonical.url or "Unknown")[:255]
        db.add(IncidentEvidence(
            organization_id=org,
            incident_id=incident.id,
            filename=f"event-{event.id}.json",
            file_type="Event reference",
            description=f"Canonical analysis persisted in event {event.id}",
            url=(canonical.url or "")[:500] or None,
            method=canonical.method,
            status_code=canonical.status_code,
            user_agent=canonical.user_agent,
            ip_address=canonical.src_ip,
            risk_score=risk["risk_score"],
            detection_reason=message[:500],
        ))

    if audit:
        db.add(AuditLog(
            organization_id=org,
            action="INGEST_EVENT",
            resource_type="EVENT",
            resource_id=str(event.id),
            description="Telemetry normalized and analyzed; source identity remains unverified.",
        ))
        db.flush()

    return event


def get_events(db, website_id: int | None = None, limit: int = 100):
    query = db.query(Event)
    if website_id is not None:
        query = query.filter(Event.website_id == website_id)
    return query.order_by(Event.created_at.desc()).limit(limit).all()


def get_event(db, event_id):
    return db.query(Event).filter(Event.id == event_id).first()
