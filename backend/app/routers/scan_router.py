from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.scan_schema import ScanRequest, ScanResponse
from app.services.scan_service import (
    create_scan,
    delete_scan,
    get_all_scans,
    get_scan,
    get_scan_history,
    save_scan_result,
    update_scan_status,
)
from app.services.scanner_service import VALID_ENGINES
from app.services.scanner_worker import run_scan_background

router = APIRouter(
    prefix="/scans",
    tags=["Scans"],
)


@router.post("/", response_model=ScanResponse)
def start_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    engine = request.engine.lower()
    if engine not in VALID_ENGINES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid engine '{engine}'. Choose from: {', '.join(VALID_ENGINES)}",
        )

    scan = create_scan(
        db,
        request.website_id,
        engine,
    )

    if scan is None:
        raise HTTPException(
            status_code=404,
            detail="Website not found",
        )

    # Dispatch scan execution in the background
    background_tasks.add_task(run_scan_background, scan.id, engine)

    return scan


@router.get("", response_model=list[ScanResponse])
def all_scans(
    db: Session = Depends(get_db),
):
    """List every scan across all websites, newest first."""
    return get_all_scans(db)


@router.get("/{scan_id}", response_model=ScanResponse)
def scan_details(
    scan_id: int,
    db: Session = Depends(get_db),
):
    scan = get_scan(db, scan_id)

    if scan is None:
        raise HTTPException(
            status_code=404,
            detail="Scan not found",
        )

    return scan


@router.get("/history/{website_id}", response_model=list[ScanResponse])
def scan_history(
    website_id: int,
    db: Session = Depends(get_db),
):
    return get_scan_history(db, website_id)


@router.put("/{scan_id}/status", response_model=ScanResponse)
def change_scan_status(
    scan_id: int,
    status: str,
    db: Session = Depends(get_db),
):
    scan = update_scan_status(
        db,
        scan_id,
        status,
    )

    if scan is None:
        raise HTTPException(
            status_code=404,
            detail="Scan not found",
        )

    return scan


@router.put("/{scan_id}/result", response_model=ScanResponse)
def upload_scan_result(
    scan_id: int,
    findings: int,
    risk_score: int,
    raw_output: str,
    parsed_output: dict,
    db: Session = Depends(get_db),
):
    scan = save_scan_result(
        db,
        scan_id,
        findings,
        risk_score,
        raw_output,
        parsed_output,
    )

    if scan is None:
        raise HTTPException(
            status_code=404,
            detail="Scan not found",
        )

    return scan


@router.delete("/{scan_id}")
def remove_scan(
    scan_id: int,
    db: Session = Depends(get_db),
):
    """Delete a scan record by ID."""
    deleted = delete_scan(db, scan_id)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Scan not found",
        )

    return {"deleted": True, "id": scan_id}