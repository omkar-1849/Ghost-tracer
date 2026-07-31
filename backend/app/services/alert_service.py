from sqlalchemy.orm import Session
from app.models.alert import Alert


def create_alert(db: Session, ip_address: str, threat_level: str, message: str):
    alert = Alert(
        ip_address=ip_address,
        threat_level=threat_level,
        message=message
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert


def get_recent_alerts(db: Session):
    return (
        db.query(Alert)
        .order_by(Alert.created_at.desc())
        .limit(5)
        .all()
    )