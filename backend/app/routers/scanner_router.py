from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.schemas.scan_schema import ScanRequest
# from app.services.scanner_service import run_sqlmap_scan

from app.services.scanner_service import (
    run_sqlmap_scan,
    cancel_scan,
    get_scan_history,
    get_scan_by_id,
)


router = APIRouter(
    prefix="/scanner",
    tags=["Scanner"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/sqlmap")
def sqlmap_scan(
    request: ScanRequest,
    db: Session = Depends(get_db)
):
    return run_sqlmap_scan(db, request.target)

@router.post("/{scan_id}/cancel")
def cancel_scan_endpoint(
    scan_id: int,
    db: Session = Depends(get_db)
):
    scan = cancel_scan(db, scan_id)

    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    return scan

@router.get("/history")
def scan_history(db: Session = Depends(get_db)):
    return get_scan_history(db)

@router.get("/report/{scan_id}")
def scan_report(
    scan_id: int,
    db: Session = Depends(get_db)
):
    scan = get_scan_by_id(db, scan_id)

    if not scan:
        raise HTTPException(status_code=404, detail="Report not found")

    return scan

# @router.get("/{scan_id}")
# def scan_details(
#     scan_id: int,
#     db: Session = Depends(get_db)
# ):
#     return get_scan_by_id(db, scan_id)