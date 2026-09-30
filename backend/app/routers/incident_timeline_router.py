from app.utils.authorization import TenantContext, get_tenant_context, require_roles, scoped_get
from app.models.incident import Incident
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.incident_timeline_schema import IncidentTimelineResponse
from app.services import incident_timeline_service

router = APIRouter(
    prefix="/incidents",
    tags=["Incident Timeline"]
)


@router.get(
    "/{incident_id}/timeline",
    response_model=list[IncidentTimelineResponse]
)
def get_timeline(
    incident_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    scoped_get(db, Incident, incident_id, ctx)
    return incident_timeline_service.get_incident_timeline(
        db,
        incident_id
    )