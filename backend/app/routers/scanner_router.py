from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.scan import Scan
from app.models.website import Website
from app.schemas.scan_schema import ScanRequest, ScanResponse
from app.services.scanner_service import (
    run_scan as run_scan_service,
    cancel_scan,
    VALID_ENGINES,
)
from app.services.scanners.scanner_factory import ScannerFactory
from app.utils.authorization import (
    TenantContext,
    get_tenant_context,
    require_roles,
    scoped_get,
)

router = APIRouter(
    prefix="/scanner",
    tags=["Scanner"],
)

_READ_ROLES = ("owner", "admin", "analyst", "viewer")
_LAUNCH_ROLES = ("owner", "admin", "analyst")


def _get_tenant_scan(db: Session, scan_id: int, context: TenantContext) -> Scan:
    scan = (
        db.query(Scan)
        .filter(Scan.id == scan_id, Scan.organization_id == context.organization_id)
        .first()
    )
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.post("/run", response_model=ScanResponse, deprecated=True)
def run_scan(
    request: ScanRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles("owner", "admin", "analyst")),
):
    """Start a manual scan for a verified website (legacy alias of POST /scans)."""
    engine = request.engine.lower()
    if engine not in VALID_ENGINES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid engine '{engine}'. Choose from: {', '.join(VALID_ENGINES)}",
        )

    try:
        scan = run_scan_service(
            db=db,
            website_id=request.website_id,
            engine=engine,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    return scan


@router.post("/{scan_id}/cancel", response_model=ScanResponse)
def cancel_scan_endpoint(
    scan_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles("owner", "admin", "analyst")),
):
    """Cancel a pending or running scan (owner/admin/analyst)."""
    scan = _get_tenant_scan(db, scan_id, context)
    cancelled = cancel_scan(db, scan.id)
    if cancelled is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return cancelled


@router.get("/engines")
def list_engines(
    context: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """List all available scanner engines (any organization member)."""
    engine_info = {
        "nmap": {"description": "Network port and service scanner", "type": "subprocess"},
        "nuclei": {"description": "Vulnerability scanner with templates", "type": "subprocess"},
        "sqlmap": {"description": "SQL injection detection tool", "type": "subprocess"},
        "nikto": {"description": "Web server vulnerability scanner", "type": "subprocess"},
        "zap": {"description": "OWASP ZAP web security scanner", "type": "api"},
        "ssl": {"description": "SSL/TLS certificate analyzer", "type": "builtin"},
    }
    engines = []
    for name in ScannerFactory.list_engines():
        info = engine_info.get(name, {"description": name, "type": "unknown"})
        engines.append({
            "name": name,
            "description": info["description"],
            "type": info["type"],
        })
    return {"engines": engines}


@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """Get scan details by ID (organization members only)."""
    return _get_tenant_scan(db, scan_id, context)


@router.get("/{scan_id}/report")
def get_scan_report(
    scan_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_roles(*_READ_ROLES)),
):
    """Get the parsed report for a completed scan (organization members only)."""
    scan = _get_tenant_scan(db, scan_id, context)
    return {
        "id": scan.id,
        "engine": scan.engine,
        "status": scan.status,
        "target": scan.target,
        "findings": scan.findings,
        "risk_score": scan.risk_score,
        "report": scan.parsed_output,
        "error": scan.error,
    }
