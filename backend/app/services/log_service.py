from sqlalchemy.orm import Session

from app.models.log import Log
from app.schemas.log_schema import LogCreate
from app.services.alert_service import create_alert
from app.services.behavior_service import detect_brute_force
from app.services.risk_service import calculate_risk


def create_log(db: Session, log: LogCreate):

    risk_analysis = calculate_risk({
        "event": log.message,
        "status_code": log.status_code,
        "url": log.url,
        "user_agent": log.user_agent
    })

    brute_force = detect_brute_force(db, log.ip_address)

    if brute_force:
        risk_analysis["risk_score"] += brute_force["score"]
        risk_analysis["threat_level"] = "CRITICAL"
        risk_analysis["reasons"].append("Brute Force Attack")

    db_log = Log(
        ip_address=log.ip_address,
        method=log.method,
        url=log.url,
        status_code=log.status_code,
        user_agent=log.user_agent,
        message=log.message,
        risk_score=risk_analysis["risk_score"],
        threat_level=risk_analysis["threat_level"],
        detection_reason=", ".join(risk_analysis["reasons"])
    )

    db.add(db_log)
    db.commit()
    db.refresh(db_log)

    if risk_analysis["threat_level"] in ["HIGH", "CRITICAL"]:
        create_alert(
            db=db,
            ip_address=log.ip_address,
            threat_level=risk_analysis["threat_level"],
            message=", ".join(risk_analysis["reasons"]),
            log=db_log
        )

    return db_log


def get_recent_logs(db: Session):
    return (
        db.query(Log)
        .order_by(Log.timestamp.desc())
        .limit(10)
        .all()
    )