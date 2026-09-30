from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.user import User
from app.models.organization_member import OrganizationMember

from app.models.incident import Incident
from datetime import datetime, timedelta
from app.services.incident_timeline_service import create_timeline_event
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id
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
    user_id: int | None = None,
    organization_id: int | None = None,
):
    if organization_id is None:
        organization_id = resolve_audit_organization_id(db, user_id)

    incident = Incident(
        organization_id=organization_id,
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
    db.flush()
    db.refresh(incident)

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=user_id,
        action="CREATE_INCIDENT",
        resource_type="INCIDENT",
        resource_id=str(incident.id),
        description=f"Incident '{incident.incident_code}' created.",
    )

    return incident


def get_all_incidents(
    db: Session,
    status: str = None,
    severity: str = None,
    assigned_to: str = None,
    search: str = None,
    limit: int = 20,
    offset: int = 0,
    organization_id: int | None = None,
):
    query = db.query(Incident)
    if organization_id is not None:
        query = query.filter(Incident.organization_id == organization_id)

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
    user_id: int | None = None,
    organization_id: int | None = None,
):
    incident = get_incident_by_id(db, incident_id)

    if not incident:
        return None

    incident.status = status
    if status != "RESOLVED":
        incident.resolved_at = None

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

        create_audit_log(
            db=db,
            organization_id=organization_id if organization_id is not None else resolve_audit_organization_id(db, user_id),
            user_id=user_id,
            action="CLOSE_INCIDENT",
            resource_type="INCIDENT",
            resource_id=str(incident.id),
            description=f"Incident '{incident.incident_code}' closed/resolved.",
        )
    else:
        create_audit_log(
            db=db,
            organization_id=organization_id if organization_id is not None else resolve_audit_organization_id(db, user_id),
            user_id=user_id,
            action="UPDATE_INCIDENT",
            resource_type="INCIDENT",
            resource_id=str(incident.id),
            description=f"Incident '{incident.incident_code}' status changed to {status}.",
        )

    db.flush()
    db.refresh(incident)

    return incident

def assign_incident(
    db: Session,
    incident_id: int,
    assigned_to: str,
    user_id: int,
    organization_id: int,
):
    incident = get_incident_by_id(db, incident_id)

    if not incident:
        return None

    assignee_query = db.query(User).join(OrganizationMember, OrganizationMember.user_id == User.id).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.role.in_(["owner", "admin", "analyst"]), User.is_active.is_(True),
    )
    if assigned_to.isdigit():
        assignee_query = assignee_query.filter(User.id == int(assigned_to))
    else:
        assignee_query = assignee_query.filter(User.email == assigned_to.strip().lower())
    assignee = assignee_query.first()
    if assignee is None:
        raise HTTPException(status_code=400, detail="Assignee must be an active analyst in this organization.")
    incident.assigned_to = assignee.email
    incident.assigned_at = (
        datetime.utcnow() + timedelta(hours=5, minutes=30)
    )

    db.flush()
    db.refresh(incident)

    create_timeline_event(
        db=db,
        incident_id=incident.id,
        event="Incident Assigned",
        description=f"Assigned to {assigned_to}."
    )

    create_audit_log(db, organization_id, "ASSIGN_INCIDENT", user_id=user_id,
                     resource_type="INCIDENT", resource_id=str(incident.id),
                     description=f"Incident assigned to {assignee.email}.")
    return incident

def get_incident_statistics(db: Session, organization_id: int):
    incidents = db.query(Incident).filter(Incident.organization_id == organization_id).all()

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