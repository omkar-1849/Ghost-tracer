from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.incident_note_schema import (
    IncidentNoteCreate,
    IncidentNoteResponse
)
from app.services import incident_note_service
from app.services.incident_timeline_service import create_timeline_event

router = APIRouter(
    prefix="/incidents",
    tags=["Incident Notes"]
)


@router.post(
    "/{incident_id}/notes",
    response_model=IncidentNoteResponse
)
def add_note(
    incident_id: int,
    payload: IncidentNoteCreate,
    db: Session = Depends(get_db)
):
    note = incident_note_service.create_note(
        db=db,
        incident_id=incident_id,
        analyst=payload.analyst,
        note=payload.note
    )

    create_timeline_event(
        db=db,
        incident_id=incident_id,
        event="Note Added",
        description=f"{payload.analyst} added an investigation note."
    )

    return note


@router.get(
    "/{incident_id}/notes",
    response_model=list[IncidentNoteResponse]
)
def get_notes(
    incident_id: int,
    db: Session = Depends(get_db)
):
    return incident_note_service.get_notes(
        db,
        incident_id
    )