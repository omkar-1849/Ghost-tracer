from sqlalchemy.orm import Session

from app.models.event import Event


def create_event(
    db: Session,
    integration,
    event_data,
):
    event = Event(
        website_id=integration.website_id,
        integration_id=integration.id,
        event_type=event_data.event_type,
        severity=event_data.severity,
        source=event_data.source,
        title=event_data.title,
        description=event_data.description,
        ip_address=event_data.ip_address,
        user_agent=event_data.user_agent,
        event_metadata=event_data.event_metadata,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


def get_events(
    db: Session,
    website_id: int,
):
    return (
        db.query(Event)
        .filter(Event.website_id == website_id)
        .order_by(Event.created_at.desc())
        .all()
    )


def get_event(
    db: Session,
    event_id: int,
):
    return (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )