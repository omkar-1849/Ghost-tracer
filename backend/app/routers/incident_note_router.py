from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.incident import Incident
from app.schemas.incident_note_schema import IncidentNoteCreate, IncidentNoteResponse
from app.services import incident_note_service
from app.services.incident_timeline_service import create_timeline_event
from app.services.audit_log_service import create_audit_log
from app.utils.authorization import TenantContext, get_tenant_context, require_roles, scoped_get

router = APIRouter(prefix="/incidents", tags=["Incident Notes"])


@router.post("/{incident_id}/notes", response_model=IncidentNoteResponse)
def add_note(incident_id: int, payload: IncidentNoteCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin", "analyst"))):
    scoped_get(db, Incident, incident_id, ctx)
    analyst = ctx.user.email
    note = incident_note_service.create_note(db, incident_id, analyst, payload.note, organization_id=ctx.organization_id)
    create_timeline_event(db, incident_id, "Note Added", f"{analyst} added an investigation note.")
    create_audit_log(db=db, organization_id=ctx.organization_id, user_id=ctx.user.id,
                     action="ADD_INCIDENT_NOTE", resource_type="INCIDENT", resource_id=str(incident_id),
                     description=f"Note added to incident {incident_id}.")
    return note


@router.get("/{incident_id}/notes", response_model=list[IncidentNoteResponse])
def get_notes(incident_id: int, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    scoped_get(db, Incident, incident_id, ctx)
    return incident_note_service.get_notes(db, incident_id)
