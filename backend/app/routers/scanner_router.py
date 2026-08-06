from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.scan import Scan
from app.schemas.scan_schema import ScanRequest, ScanResponse
from app.services.scanner_service import (
    run_scan as run_scan_service,
    cancel_scan,
    VALID_ENGINES,
)
from app.services.scanners.scanner_factory import ScannerFactory

router = APIRouter(
    prefix="/scanner",
    tags=["Scanner"],
)


@router.post("/run", response_model=ScanResponse)
def run_scan(
    request: ScanRequest,
    db: Session = Depends(get_db),
):
    """Start a scan using any registered scanner engine."""
    engine = request.engine.lower()
    if engine not in VALID_ENGINES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid engine '{engine}'. Choose from: {', '.join(VALID_ENGINES)}",
        )

    scan = run_scan_service(
        db=db,
        website_id=request.website_id,
        engine=engine,
    )

    if scan is None:
        raise HTTPException(
            status_code=404,
            detail="Website not found",
        )

    return scan


@router.post("/{scan_id}/cancel", response_model=ScanResponse)
def cancel_scan_endpoint(
    scan_id: int,
    db: Session = Depends(get_db),
):
    """Cancel a pending or running scan."""
    scan = cancel_scan(db, scan_id)

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found",
        )

    return scan


@router.get("/engines")
def list_engines():
    """List all available scanner engines."""
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
):
    """Get scan details by ID."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found",
        )

    return scan


@router.get("/{scan_id}/report")
def get_scan_report(
    scan_id: int,
    db: Session = Depends(get_db),
):
    """Get the parsed report for a completed scan."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

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