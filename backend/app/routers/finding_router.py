from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database.database import get_db
from app.models.scanner_finding import ScannerFinding
from app.schemas.scanner_finding_schema import (
    ScannerFindingDetailResponse,
    ScannerFindingResponse,
    ScannerFindingStatusUpdate,
)
from app.utils.authorization import (
    TenantContext,
    get_tenant_context,
    require_roles,
    scoped_get,
)

router = APIRouter(
    prefix="/findings",
    tags=["Findings"],
)

_READ_ROLES = ("owner", "admin", "analyst", "viewer")
_WRITE_ROLES = ("owner", "admin", "analyst")


@router.get("", response_model=list[ScannerFindingResponse])
@router.get("/", response_model=list[ScannerFindingResponse], include_in_schema=False)
def list_findings(
    website_id: int | None = Query(None),
    status: str | None = Query(None),
    severity: str | None = Query(None),
    engine: str | None = Query(None),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """List scanner findings for this tenant with optional filtering."""
    query = db.query(ScannerFinding).filter(
        ScannerFinding.organization_id == ctx.organization_id
    )

    if website_id is not None:
        query = query.filter(ScannerFinding.website_id == website_id)
    if status is not None:
        query = query.filter(ScannerFinding.status == status.lower())
    if severity is not None:
        query = query.filter(ScannerFinding.severity == severity.lower())
    if engine is not None:
        query = query.filter(ScannerFinding.engine == engine.lower())

    return query.order_by(ScannerFinding.last_seen_at.desc()).all()


@router.get("/{finding_id}", response_model=ScannerFindingDetailResponse)
def get_finding(
    finding_id: int,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """Get full details and observations of a specific finding."""
    finding = (
        db.query(ScannerFinding)
        .options(joinedload(ScannerFinding.observations))
        .filter(
            ScannerFinding.id == finding_id,
            ScannerFinding.organization_id == ctx.organization_id,
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found.")
    return finding


@router.patch("/{finding_id}/status", response_model=ScannerFindingResponse)
def update_finding_status(
    finding_id: int,
    payload: ScannerFindingStatusUpdate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_roles(*_WRITE_ROLES)),
):
    """Update finding status (open, acknowledged, resolved, false_positive, accepted_risk)."""
    finding = scoped_get(db, ScannerFinding, finding_id, ctx)
    finding.status = payload.status
    finding.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(finding)
    return finding
