from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.log import Log
from app.config.rules import RISK_RULES


def get_recent_failed_logins(db: Session, ip_address: str):
    one_minute_ago = datetime.utcnow() - timedelta(minutes=1)

    return (
        db.query(Log)
        .filter(
            Log.ip_address == ip_address,
            Log.message.like("%login_failed%"),
            Log.timestamp >= one_minute_ago
        )
        .all()
    )


def detect_brute_force(db: Session, ip_address: str):
    failed_logins = get_recent_failed_logins(db, ip_address)

    if len(failed_logins) >= 5:
        return {
            "detected": True,
            "score": RISK_RULES["BRUTE_FORCE"],
            "reason": "Brute Force Attack"
        }

    return {
        "detected": False,
        "score": 0,
        "reason": None
    }