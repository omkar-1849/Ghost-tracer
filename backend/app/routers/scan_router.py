from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.scan import Scan
from app.models.website import Website
from app.schemas.investigation_schema import InvestigationResponse
from app.schemas.scan_schema import ScanRequest, ScanResponse
from app.schemas.scanner_finding_schema import ScannerFindingResponse
from app.services.scan_service import (
    create_scan,
    delete_scan,
    get_all_scans,
    get_scan,
    get_scan_history,
)
from app.services.scanner_service import VALID_ENGINES
from app.utils.authorization import (
    TenantContext,
    require_roles,
)

router = APIRouter(
    prefix="/scans",
    tags=["Scans"],
)

_READ_ROLES = ("owner", "admin", "analyst", "viewer")
_LAUNCH_ROLES = ("owner", "admin", "analyst")
_ADMIN_ONLY = ("owner", "admin")


def _tenant_query(db: Session, context: TenantContext):
    return db.query(Scan).filter(Scan.organization_id == context.organization_id)


@router.post("", response_model=ScanResponse, include_in_schema=False)
@router.post("/", response_model=ScanResponse)
def start_scan(
    request: ScanRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_LAUNCH_ROLES)),
):
    """Queue a manual scan for a verified website (owner/admin/analyst)."""
    engine = request.engine.lower()
    if engine not in VALID_ENGINES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid engine '{engine}'. Choose from: {', '.join(VALID_ENGINES)}",
        )

    try:
        scan = create_scan(db, request.website_id, engine, profile=request.profile)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    from app.services.scanner_worker import enqueue_scan
    enqueue_scan(scan.id)
    return scan


@router.get("", response_model=list[ScanResponse])
def all_scans(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """List this organization's scans, newest first."""
    return (
        _tenant_query(db, context)
        .order_by(Scan.created_at.desc())
        .all()
    )


@router.get("/history/{website_id}", response_model=list[ScanResponse])
def scan_history(
    website_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """Scan history for one of this organization's websites."""
    website = (
        db.query(Website)
        .filter(
            Website.id == website_id,
            Website.organization_id == context.organization_id,
        )
        .first()
    )
    if website is None:
        raise HTTPException(status_code=404, detail="Website not found")
    return (
        _tenant_query(db, context)
        .filter(Scan.website_id == website_id)
        .order_by(Scan.created_at.desc())
        .all()
    )


@router.get("/{scan_id}", response_model=ScanResponse)
def scan_details(
    scan_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    scan = (
        _tenant_query(db, context)
        .filter(Scan.id == scan_id)
        .first()
    )
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.delete("/{scan_id}")
def remove_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_ADMIN_ONLY)),
):
    """Delete a terminal scan record (owner/admin only)."""
    scan = (
        _tenant_query(db, context)
        .filter(Scan.id == scan_id)
        .first()
    )
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    from app.services.scan_service import delete_scan
    try:
        deleted = delete_scan(db, scan.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    if not deleted:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {"deleted": True, "id": scan_id}


@router.get("/{scan_id}/findings", response_model=list[ScannerFindingResponse])
def scan_findings(
    scan_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """List findings associated with this specific scan."""
    scan = _tenant_query(db, context).filter(Scan.id == scan_id).first()
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    from app.models.scanner_finding import ScannerFinding
    from app.models.scanner_finding_observation import ScannerFindingObservation

    finding_ids = (
        db.query(ScannerFindingObservation.finding_id)
        .filter(
            ScannerFindingObservation.scan_id == scan.id,
            ScannerFindingObservation.organization_id == context.organization_id,
        )
        .distinct()
        .all()
    )
    ids = [fid[0] for fid in finding_ids]
    if not ids:
        return []

    return (
        db.query(ScannerFinding)
        .filter(
            ScannerFinding.id.in_(ids),
            ScannerFinding.organization_id == context.organization_id,
        )
        .order_by(ScannerFinding.severity.desc())
        .all()
    )


@router.get("/{scan_id}/investigation", response_model=InvestigationResponse)
def scan_investigation(
    scan_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """Get the latest investigation and report for this scan."""
    scan = _tenant_query(db, context).filter(Scan.id == scan_id).first()
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    from app.models.investigation import Investigation

    investigation = (
        db.query(Investigation)
        .filter(
            Investigation.trigger_scan_id == scan.id,
            Investigation.organization_id == context.organization_id,
        )
        .order_by(Investigation.created_at.desc())
        .first()
    )
    if investigation is None:
        raise HTTPException(status_code=404, detail="No investigation found for this scan")
    return investigation


@router.post("/{scan_id}/investigate", response_model=InvestigationResponse)
def trigger_scan_investigation(
    scan_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_LAUNCH_ROLES)),
):
    """Trigger or re-run investigation for a completed scan (idempotent if running)."""
    scan = _tenant_query(db, context).filter(Scan.id == scan_id).first()
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    if scan.status not in ("Completed", "Failed"):
        raise HTTPException(
            status_code=400,
            detail="Cannot investigate a scan that is still in progress",
        )

    from app.models.investigation import Investigation
    from app.services.finding_normalization_service import process_completed_scan

    existing = (
        db.query(Investigation)
        .filter(
            Investigation.trigger_scan_id == scan.id,
            Investigation.organization_id == context.organization_id,
            Investigation.status.in_(["PENDING", "PROCESSING"]),
        )
        .first()
    )
    if existing:
        return existing

    inv_id = process_completed_scan(scan.id)
    if not inv_id:
        raise HTTPException(
            status_code=400,
            detail="Could not trigger investigation for this scan",
        )

    investigation = (
        db.query(Investigation)
        .filter(Investigation.id == inv_id)
        .first()
    )
    return investigation


@router.put("/{scan_id}/status", deprecated=True)
@router.put("/{scan_id}/result", deprecated=True)
def trusted_server_only(scan_id: int, context: TenantContext = Depends(require_roles(*_READ_ROLES))):
    """Deprecated: scan status/results are written only by trusted managed workers."""
    raise HTTPException(403, "Scan status and results are trusted server-worker operations only.")
