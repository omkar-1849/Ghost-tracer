from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.incident_note_schema import (
    IncidentNoteCreate,
    IncidentNoteResponse
)
from app.services import incident_note_service
from app.services.incident_timeline_service import create_timeline_event
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id

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

    # Resolve organization + user from the analyst field (email or user_id)
    from app.models.user import User
    user_id = None
    organization_id = 1

    if payload.analyst and payload.analyst.isdigit():
        user_id = int(payload.analyst)
    elif payload.analyst:
        user = (
            db.query(User)
            .filter(User.email == payload.analyst.lower().strip())
            .first()
        )
        if user:
            user_id = user.id

    if user_id is not None:
        organization_id = resolve_audit_organization_id(db, user_id)

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=user_id,
        action="ADD_INCIDENT_NOTE",
        resource_type="INCIDENT",
        resource_id=str(incident_id),
        description=f"Note added to incident {incident_id}.",
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