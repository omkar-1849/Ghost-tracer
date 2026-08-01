from sqlalchemy.orm import Session

from app.models.incident import Incident


def create_incident(
    db: Session,
    incident_code: str,
    title: str,
    description: str,
    threat_level: str,
    priority: str,
    status: str,
    source_ip: str,
    target: str,
    confidence: int,
):
    incident = Incident(
        incident_code=incident_code,
        title=title,
        description=description,
        threat_level=threat_level,
        priority=priority,
        status=status,
        source_ip=source_ip,
        target=target,
        confidence=confidence,
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)

    return incident


def get_all_incidents(db: Session):
    return (
        db.query(Incident)
        .order_by(Incident.created_at.desc())
        .all()
    )


def get_incident_by_id(db: Session, incident_id: int):
    return (
        db.query(Incident)
        .filter(Incident.id == incident_id)
        .first()
    )


def update_incident_status(
    db: Session,
    incident_id: int,
    status: str,
):
    incident = get_incident_by_id(db, incident_id)

    if not incident:
        return None

    incident.status = status

    db.commit()
    db.refresh(incident)

    return incident