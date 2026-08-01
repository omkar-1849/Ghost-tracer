import threading
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.scan_result import ScanResult
from app.services.scanner_worker import process_sqlmap_scan

CANCELLABLE_STATUSES = ("QUEUED", "RUNNING")


def run_sqlmap_scan(db: Session, target: str):
    scan = ScanResult(
        target=target,
        scanner="SQLMap",
        status="QUEUED",
        findings=""
    )

    db.add(scan)
    db.commit()
    db.refresh(scan)

    threading.Thread(
        target=process_sqlmap_scan,
        args=(scan.id,),
        daemon=True,
    ).start()

    return scan


def cancel_scan(db: Session, scan_id: int):
    scan = db.query(ScanResult).filter(ScanResult.id == scan_id).first()

    if not scan:
        return None

    if scan.status not in CANCELLABLE_STATUSES:
        return scan

    scan.status = "CANCELLED"
    scan.completed_at = (
        datetime.utcnow() + timedelta(hours=5, minutes=30)
    )

    db.commit()
    db.refresh(scan)

    return scan


def get_scan_history(db: Session):
    return (
        db.query(ScanResult)
        .order_by(ScanResult.created_at.desc())
        .all()
    )


def get_scan_by_id(db: Session, scan_id: int):
    return (
        db.query(ScanResult)
        .filter(ScanResult.id == scan_id)
        .first()
    )
