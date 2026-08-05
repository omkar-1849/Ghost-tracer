from sqlalchemy.orm import Session

from app.models.incident import Incident
from datetime import datetime, timedelta
from app.services.incident_timeline_service import create_timeline_event
from sqlalchemy import or_

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


def get_all_incidents(
    db: Session,
    status: str = None,
    severity: str = None,
    assigned_to: str = None,
    search: str = None,
    limit: int = 20,
    offset: int = 0,
):
    query = db.query(Incident)

    if status:
        query = query.filter(Incident.status == status)

    if severity:
        query = query.filter(Incident.threat_level == severity)

    if assigned_to:
        query = query.filter(Incident.assigned_to == assigned_to)

    if search:
        query = query.filter(
            or_(
                Incident.title.ilike(f"%{search}%"),
                Incident.description.ilike(f"%{search}%"),
                Incident.source_ip.ilike(f"%{search}%"),
                Incident.incident_code.ilike(f"%{search}%"),
            )
        )

    return (
        query
        .order_by(Incident.created_at.desc())
        .offset(offset)
        .limit(limit)
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

    if status == "RESOLVED":
        incident.resolved_at = (
            datetime.utcnow() + timedelta(hours=5, minutes=30)
        )

        create_timeline_event(
            db=db,
            incident_id=incident.id,
            event="Incident Resolved",
            description="Incident marked as resolved by analyst."
        )

    db.commit()
    db.refresh(incident)

    return incident

def assign_incident(
    db: Session,
    incident_id: int,
    assigned_to: str
):
    incident = get_incident_by_id(db, incident_id)

    if not incident:
        return None

    incident.assigned_to = assigned_to
    incident.assigned_at = (
        datetime.utcnow() + timedelta(hours=5, minutes=30)
    )

    db.commit()
    db.refresh(incident)

    create_timeline_event(
        db=db,
        incident_id=incident.id,
        event="Incident Assigned",
        description=f"Assigned to {assigned_to}."
    )

    return incident

def get_incident_statistics(db: Session):
    incidents = db.query(Incident).all()

    return {
        "total": len(incidents),
        "open": sum(i.status == "OPEN" for i in incidents),
        "investigating": sum(i.status == "INVESTIGATING" for i in incidents),
        "resolved": sum(i.status == "RESOLVED" for i in incidents),
        "critical": sum(i.threat_level == "CRITICAL" for i in incidents),
        "high": sum(i.threat_level == "HIGH" for i in incidents),
        "medium": sum(i.threat_level == "MEDIUM" for i in incidents),
        "low": sum(i.threat_level == "LOW" for i in incidents),
    }