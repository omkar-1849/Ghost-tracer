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
    db: Session = Depends(get_db)
):
    return incident_timeline_service.get_incident_timeline(
        db,
        incident_id
    )