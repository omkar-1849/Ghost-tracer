from sqlalchemy.orm import Session

from app.models.incident_timeline import IncidentTimeline


def create_timeline_event(
    db: Session,
    incident_id: int,
    event: str,
    description: str
):
    timeline = IncidentTimeline(
        incident_id=incident_id,
        event=event,
        description=description
    )

    db.add(timeline)
    db.commit()
    db.refresh(timeline)

    return timeline


def get_incident_timeline(
    db: Session,
    incident_id: int
):
    return (
        db.query(IncidentTimeline)
        .filter(IncidentTimeline.incident_id == incident_id)
        .order_by(IncidentTimeline.created_at.asc())
        .all()
    )