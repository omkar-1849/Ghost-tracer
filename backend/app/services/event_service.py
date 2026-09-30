from datetime import datetime, timezone
from fastapi import HTTPException
from app.models.event import Event
from app.models.audit_log import AuditLog
from app.models.incident_evidence import IncidentEvidence
from app.services.alert_service import create_alert
from app.services.ai_analyst_service import analyze_security_event
from app.services.behavior_service import get_attempt_signal, is_auth_failure
from app.services.deduplication_service import fingerprint_from_canonical, find_duplicate_event
from app.services.detection_service import detect_event
from app.services.event_normalizer import normalize_security_event
from app.services.risk_service import calculate_risk
from app.schemas.ai_analyst_schema import AIAnalystInput


def create_event(db, integration, event_data):
    org = db.info.get("organization_id")
    if not org or integration.organization_id != org:
        raise HTTPException(403, "Integration tenant context required")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    canonical = normalize_security_event({**event_data.model_dump(), "timestamp": now})
    fingerprint = fingerprint_from_canonical(canonical)
    duplicate = find_duplicate_event(db, integration.website_id, fingerprint, now, integration.id)
    if duplicate is not None:
        return duplicate
    # Count before persisting this event: include the current failure only once.
    attempts = get_attempt_signal(db, integration.website_id, canonical.src_ip, now,
                                  is_auth_failure(canonical.event_type, canonical.status_code))
    detection = detect_event(canonical, attempts)
    risk = calculate_risk({"event": " ".join(filter(None, [canonical.event_type, canonical.title, canonical.description])),
                           "url": canonical.url, "status_code": canonical.status_code,
                           "user_agent": canonical.user_agent}, observed_attempts=attempts["attempts"])
    analyst = analyze_security_event(AIAnalystInput(event=canonical.model_dump(mode="json"), detection=detection, risk=risk))
    detection.update({"canonical_event": canonical.model_dump(mode="json"), "risk": risk,
                      "provenance": {"organization_id": org, "integration_id": integration.id,
                                     "source_ip_trusted": False, "attempts": attempts,
                                     "engine": "deterministic_rules_v1"}})
    event = Event(organization_id=org, website_id=integration.website_id, integration_id=integration.id,
                  event_type=canonical.event_type, severity=risk["threat_level"].title(), source=canonical.source,
                  title=canonical.title or "Security event", description=canonical.description,
                  ip_address=canonical.src_ip, user_agent=canonical.user_agent, event_metadata=canonical.metadata,
                  fingerprint=fingerprint, normalization_version=1, created_at=now, processed_at=now,
                  risk_score=risk["risk_score"], threat_level=risk["threat_level"], detection_result=detection,
                  analyst_result=analyst.model_dump(mode="json"))
    db.add(event)
    db.flush()
    # HIGH/CRITICAL risk is the alert threshold, not a mere detection match.
    if risk["threat_level"] in {"HIGH", "CRITICAL"}:
        message = " | ".join(risk["reasons"]) or "Security indicators require review"
        alert, incident = create_alert(db, org, canonical.src_ip, risk["threat_level"], message,
                                       website_id=integration.website_id, event_id=event.id,
                                       detection=detection, risk=risk, actor_id=db.info.get("actor_id"))
        incident.target = (canonical.url or "Unknown")[:255]
        db.add(IncidentEvidence(organization_id=org, incident_id=incident.id, filename=f"event-{event.id}.json",
                                file_type="Event reference", description=f"Canonical analysis persisted in event {event.id}",
                                url=(canonical.url or "")[:500] or None, method=canonical.method,
                                status_code=canonical.status_code, user_agent=canonical.user_agent,
                                ip_address=canonical.src_ip, risk_score=risk["risk_score"], detection_reason=message[:500]))
    # Recommendations are stored on Event only. No ResponseAction is created.
    db.add(AuditLog(organization_id=org, action="INGEST_EVENT", resource_type="EVENT", resource_id=str(event.id),
                    description="Telemetry normalized and analyzed; source identity remains unverified."))
    db.flush()
    return event


def get_events(db, website_id, limit=100):
    return db.query(Event).filter(Event.website_id == website_id).order_by(Event.created_at.desc()).limit(limit).all()


def get_event(db, event_id):
    return db.query(Event).filter(Event.id == event_id).first()
