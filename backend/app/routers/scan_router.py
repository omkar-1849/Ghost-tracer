from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.scan import Scan
from app.models.website import Website
from app.schemas.scan_schema import ScanRequest, ScanResponse
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
_ADMIN_ONLY = ("admin",)


def _tenant_query(db: Session, context: TenantContext):
    return db.query(Scan).filter(Scan.organization_id == context.organization_id)


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
        scan = create_scan(db, request.website_id, engine)
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


@router.put("/{scan_id}/status", deprecated=True)
@router.put("/{scan_id}/result", deprecated=True)
def trusted_server_only(scan_id: int, context: TenantContext = Depends(require_roles(*_READ_ROLES))):
    """Deprecated: scan status/results are written only by trusted managed workers."""
    raise HTTPException(403, "Scan status and results are trusted server-worker operations only.")
