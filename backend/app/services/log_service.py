from sqlalchemy.orm import Session

from app.models.log import Log
from app.schemas.log_schema import LogCreate
from app.services.alert_service import create_alert
from app.services.behavior_service import get_attempt_signal, is_auth_failure
from app.models.audit_log import AuditLog
from app.services.risk_service import calculate_risk

ALERT_THREAT_LEVELS = {"HIGH", "CRITICAL"}
MAX_RISK_SCORE = 100


def create_log(db: Session, log: LogCreate, website_id: int | None = None):
    """Analyze, store and correlate one HTTP log; flush-only, single commit.

    Risk is computed only from server-derived signals; no caller field can
    claim risk, confidence or actions.
    """
    attempt_signal = get_attempt_signal(
        db,
        website_id,
        log.ip_address,
        current_failure=is_auth_failure(status_code=log.status_code, message=log.message),
    )

    risk_analysis = calculate_risk(
        {
            "event": log.message or "",
            "status_code": log.status_code,
            "url": log.url or "",
            "user_agent": log.user_agent or "",
        },
        observed_attempts=attempt_signal["attempts"],
    )

    # Score is always server-capped before persistence.
    risk_analysis["risk_score"] = min(risk_analysis["risk_score"], MAX_RISK_SCORE)

    db_log = Log(
        organization_id=db.info.get("organization_id"),
        website_id=website_id,
        ip_address=log.ip_address,
        method=log.method,
        url=log.url,
        status_code=log.status_code,
        user_agent=log.user_agent,
        message=log.message,
        risk_score=risk_analysis["risk_score"],
        threat_level=risk_analysis["threat_level"],
        detection_reason=", ".join(risk_analysis["reasons"])[:255],
    )

    db.add(db_log)
    db.flush()

    # Only policy-level threat pages; a bare detection never alerts.
    if risk_analysis["threat_level"] in ALERT_THREAT_LEVELS:
        create_alert(
            db=db,
            organization_id=db.info["organization_id"],
            ip_address=log.ip_address or "Unknown",
            threat_level=risk_analysis["threat_level"],
            message=", ".join(risk_analysis["reasons"]) or "Security threat detected.",
            website_id=website_id,
            log=db_log,
            risk=risk_analysis,
            actor_id=db.info.get("actor_id"),
        )

    db.add(AuditLog(organization_id=db.info["organization_id"], action="INGEST_LOG", resource_type="LOG",
                    resource_id=str(db_log.id), description="HTTP telemetry analyzed; reported source identity is unverified."))
    db.flush()
    return db_log


def get_recent_logs(db: Session, limit=10):
    return (
        db.query(Log)
        .order_by(Log.timestamp.desc())
        .limit(min(limit, 100))
        .all()
    )
