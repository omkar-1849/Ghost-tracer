from sqlalchemy.orm import Session
from app.models.log import Log
from app.models.alert import Alert


def get_dashboard_stats(db: Session):
    total_logs = db.query(Log).count()

    total_alerts = db.query(Alert).count()

    critical_alerts = (
        db.query(Alert)
        .filter(Alert.threat_level == "CRITICAL")
        .count()
    )

    high_alerts = (
        db.query(Alert)
        .filter(Alert.threat_level == "HIGH")
        .count()
    )

    return {
        "total_logs": total_logs,
        "total_alerts": total_alerts,
        "critical_alerts": critical_alerts,
        "high_alerts": high_alerts,
    }