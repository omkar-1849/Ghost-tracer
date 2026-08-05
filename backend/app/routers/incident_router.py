from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db

from app.schemas.incident_schema import (
    IncidentResponse,
    IncidentUpdateStatus,
    IncidentAssign,
)
from typing import Optional
from app.services import incident_service
from app.services.incident_timeline_service import get_incident_timeline
from app.services.incident_evidence_service import get_incident_evidence
from app.services.incident_note_service import get_notes

router = APIRouter(
    prefix="/incidents",
    tags=["Incidents"]
)


@router.get("/", response_model=list[IncidentResponse])
def get_all_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    return incident_service.get_all_incidents(
        db=db,
        status=status,
        severity=severity,
        assigned_to=assigned_to,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/{incident_id}")
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    incident = incident_service.get_incident_by_id(
        db,
        incident_id
    )

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    return {
        "incident": incident,
        "timeline": get_incident_timeline(
            db,
            incident_id
        ),
        "evidence": get_incident_evidence(
            db,
            incident_id
        ),
        "notes": get_notes(
            db,
            incident_id
        )
    }


@router.patch(
    "/{incident_id}/status",
    response_model=IncidentResponse
)
def update_incident_status(
    incident_id: int,
    payload: IncidentUpdateStatus,
    db: Session = Depends(get_db)
):
    incident = incident_service.update_incident_status(
        db=db,
        incident_id=incident_id,
        status=payload.status
    )

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    return incident


@router.patch(
    "/{incident_id}/assign",
    response_model=IncidentResponse
)
def assign_incident(
    incident_id: int,
    payload: IncidentAssign,
    db: Session = Depends(get_db)
):
    incident = incident_service.assign_incident(
        db=db,
        incident_id=incident_id,
        assigned_to=payload.assigned_to
    )

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    return incident

@router.get("/statistics/overview")
def get_statistics(
    db: Session = Depends(get_db)
):
    return incident_service.get_incident_statistics(db)