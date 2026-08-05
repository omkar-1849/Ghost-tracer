from sqlalchemy.orm import Session

from app.models.incident_note import IncidentNote


def create_note(
    db: Session,
    incident_id: int,
    analyst: str,
    note: str
):
    incident_note = IncidentNote(
        incident_id=incident_id,
        analyst=analyst,
        note=note
    )

    db.add(incident_note)
    db.commit()
    db.refresh(incident_note)

    return incident_note


def get_notes(
    db: Session,
    incident_id: int
):
    return (
        db.query(IncidentNote)
        .filter(IncidentNote.incident_id == incident_id)
        .order_by(IncidentNote.created_at.asc())
        .all()
    )