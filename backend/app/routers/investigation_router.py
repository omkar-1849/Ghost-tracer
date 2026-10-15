from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.investigation import Investigation
from app.models.investigation_job import InvestigationJob
from app.schemas.investigation_schema import InvestigationResponse
from app.utils.authorization import (
    TenantContext,
    require_roles,
    scoped_get,
)

router = APIRouter(
    prefix="/investigations",
    tags=["Investigations"],
)

_READ_ROLES = ("owner", "admin", "analyst", "viewer")
_WRITE_ROLES = ("owner", "admin", "analyst")


@router.get("", response_model=list[InvestigationResponse])
@router.get("/", response_model=list[InvestigationResponse], include_in_schema=False)
def list_investigations(
    website_id: int | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """List AI investigations for this tenant with optional filtering."""
    query = db.query(Investigation).filter(
        Investigation.organization_id == ctx.organization_id
    )
    if website_id is not None:
        query = query.filter(Investigation.website_id == website_id)
    if status is not None:
        query = query.filter(Investigation.status == status.upper())

    return query.order_by(Investigation.created_at.desc()).all()


@router.get("/{investigation_id}", response_model=InvestigationResponse)
def get_investigation(
    investigation_id: int,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """Get full details and evidence bundle of a specific investigation."""
    investigation = scoped_get(db, Investigation, investigation_id, ctx)
    return investigation


@router.post("/{investigation_id}/cancel", response_model=InvestigationResponse)
def cancel_investigation(
    investigation_id: int,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_roles(*_WRITE_ROLES)),
):
    """Cancel a pending or running investigation."""
    investigation = scoped_get(db, Investigation, investigation_id, ctx)
    if investigation.status in ("COMPLETED", "FAILED", "CANCELLED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel investigation in status {investigation.status}",
        )

    investigation.status = "CANCELLED"
    investigation.summary = "Investigation was cancelled by user."
    investigation.completed_at = datetime.utcnow()

    # Also cancel any associated job
    job = (
        db.query(InvestigationJob)
        .filter(InvestigationJob.investigation_id == investigation.id)
        .first()
    )
    if job and job.status in ("PENDING", "PROCESSING"):
        job.status = "CANCELLED"
        job.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(investigation)
    return investigation
