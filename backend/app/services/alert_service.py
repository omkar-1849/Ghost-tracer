from datetime import datetime, timedelta
from urllib.parse import urlsplit
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.incident import Incident
from app.models.incident_evidence import IncidentEvidence
from app.models.incident_timeline import IncidentTimeline
from app.models.audit_log import AuditLog
from app.models.log import Log

ALERT_CORRELATION_WINDOW_SECONDS = 10


def find_correlated_incident(
    db: Session,
    organization_id: int,
    website_id: int | None,
    ip_address: str,
    target_path: str,
    threat_reasons: str,
    now: datetime,
) -> tuple[Alert, Incident] | None:
    """Find recent active open incident for the exact same event across log sources.

    Correlates identical attacks from the same IP against the same asset/path
    within ALERT_CORRELATION_WINDOW_SECONDS to avoid duplicating alerts/incidents
    when multi-file loggers record the same HTTP transaction.
    """
    window_start = now - timedelta(seconds=ALERT_CORRELATION_WINDOW_SECONDS)
    candidates = (
        db.query(Alert)
        .filter(
            Alert.organization_id == organization_id,
            Alert.website_id == website_id,
            Alert.ip_address == (ip_address or None),
            Alert.created_at >= window_start,
            Alert.created_at <= now,
        )
        .order_by(Alert.created_at.desc())
        .all()
    )
    for alert in candidates:
        if alert.message != (threat_reasons or "Security threat detected.")[:255]:
            continue
        if alert.log:
            alert_path = urlsplit(alert.log.url or "").path.lower()
            if alert_path != target_path:
                continue
        incident = (
            db.query(Incident)
            .filter(
                Incident.organization_id == organization_id,
                Incident.alert_id == alert.id,
                Incident.status == "OPEN",
            )
            .first()
        )
        if incident is not None:
            return alert, incident
    return None


def create_alert(
    db: Session,
    organization_id: int,
    ip_address: str,
    threat_level: str,
    message: str,
    website_id: int | None = None,
    event_id: int | None = None,
    log: Log | None = None,
    detection: dict | None = None,
    risk: dict | None = None,
    actor_id: int | None = None,
):
    """Build the alert + incident + evidence + timeline + audit graph.

    Flush-only: every node is added to the session in dependency order with
    flushes to obtain ids, and a single commit by the request-scoped session
    (get_db) makes the whole graph atomic; any failure rolls back everything.
    """
    now = datetime.utcnow()
    req_path = urlsplit(log.url or "").path.lower() if log is not None else ""
    norm_message = (message or "Security threat detected.")[:255]

    if log is not None:
        correlated = find_correlated_incident(
            db=db,
            organization_id=organization_id,
            website_id=website_id,
            ip_address=ip_address or "Unknown",
            target_path=req_path,
            threat_reasons=norm_message,
            now=now,
        )
        if correlated is not None:
            existing_alert, existing_incident = correlated
            db.add(IncidentEvidence(
                organization_id=organization_id,
                incident_id=existing_incident.id,
                filename=f"correlated_log_{log.id}.log",
                file_type="HTTP Request",
                description=f"Correlated cross-source log record (ID {log.id})",
                url=log.url,
                method=log.method,
                status_code=log.status_code,
                user_agent=log.user_agent,
                ip_address=log.ip_address,
                risk_score=log.risk_score,
                detection_reason=log.detection_reason,
            ))
            db.add(IncidentTimeline(
                organization_id=organization_id,
                incident_id=existing_incident.id,
                event="Correlated Telemetry Attached",
                description=f"Correlated cross-source log record (Log ID {log.id}) attached to incident.",
            ))
            db.flush()
            return existing_alert, existing_incident

    alert = Alert(
        organization_id=organization_id,
        ip_address=ip_address or None,
        threat_level=threat_level,
        message=norm_message,
        website_id=website_id,
        event_id=event_id,
        log_id=log.id if log is not None else None,
        created_at=now,
    )
    db.add(alert)
    db.flush()

    detections = (detection or {}).get("detections", [])
    if detections:
        max_conf = max((d.get("confidence", 0) for d in detections), default=0.0)
        confidence = round(100 * max_conf)
    elif risk and (risk.get("risk_score") or risk.get("threat_level")):
        score = risk.get("risk_score") or (90 if threat_level == "CRITICAL" else 85)
        confidence = min(max(int(score), 80), 100)
    else:
        confidence = 90 if threat_level == "CRITICAL" else (85 if threat_level == "HIGH" else 50)

    incident = Incident(
        organization_id=organization_id,
        incident_code=f"INC-{alert.id:06d}",
        title="Security Incident",
        description=(message or "Security threat detected.")[:500],
        threat_level=threat_level,
        priority="P1" if threat_level == "CRITICAL" else "P2",
        status="OPEN",
        source_ip=ip_address or "Unknown",
        target="Unknown",
        confidence=confidence,
        website_id=website_id,
        alert_id=alert.id,
    )
    db.add(incident)
    db.flush()

    timeline = IncidentTimeline(
        organization_id=organization_id,
        incident_id=incident.id,
        event="Incident Created",
        description="Incident automatically created from a policy-level alert.",
    )
    db.add(timeline)

    evidence_rows = [
        IncidentEvidence(
            organization_id=organization_id,
            incident_id=incident.id,
            filename="risk_analysis.log",
            file_type="Analysis",
            description="Risk analysis generated by Sentinel AI.",
            risk_score=(risk or {}).get("risk_score"),
            detection_reason=", ".join((risk or {}).get("reasons", []))[:500] or None,
        ),
        IncidentEvidence(
            organization_id=organization_id,
            incident_id=incident.id,
            filename="incident_summary.json",
            file_type="JSON",
            description="Incident metadata snapshot.",
        ),
    ]

    if log is not None:
        evidence_rows.append(IncidentEvidence(
            organization_id=organization_id,
            incident_id=incident.id,
            filename="trigger_request.log",
            file_type="HTTP Request",
            description="Original request that triggered the incident.",
            url=log.url,
            method=log.method,
            status_code=log.status_code,
            user_agent=log.user_agent,
            ip_address=log.ip_address,
            risk_score=log.risk_score,
            detection_reason=log.detection_reason,
        ))

    for evidence in evidence_rows:
        db.add(evidence)

    db.add(AuditLog(
        organization_id=organization_id,
        user_id=actor_id,
        action="CREATE_INCIDENT",
        resource_type="INCIDENT",
        resource_id=str(incident.id),
        description=f"Incident '{incident.incident_code}' created from alert {alert.id}.",
    ))

    db.flush()
    return alert, incident


def get_recent_alerts(db: Session, organization_id: int | None = None, limit: int = 5):
    query = db.query(Alert)
    if organization_id is not None:
        query = query.filter(Alert.organization_id == organization_id)
    return (
        query
        .order_by(Alert.created_at.desc())
        .limit(limit)
        .all()
    )


def get_all_alerts(db: Session, organization_id: int | None = None, limit: int = 100):
    query = db.query(Alert)
    if organization_id is not None:
        query = query.filter(Alert.organization_id == organization_id)
    return (
        query
        .order_by(Alert.created_at.desc())
        .limit(limit)
        .all()
    )
