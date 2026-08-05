from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.incident_evidence_schema import IncidentEvidenceResponse
from app.services import incident_evidence_service

router = APIRouter(
    prefix="/incidents",
    tags=["Incident Evidence"]
)


@router.get(
    "/{incident_id}/evidence",
    response_model=list[IncidentEvidenceResponse]
)
def get_evidence(
    incident_id: int,
    db: Session = Depends(get_db)
):
    return incident_evidence_service.get_incident_evidence(
        db,
        incident_id
    )