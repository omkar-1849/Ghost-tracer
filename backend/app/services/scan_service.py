from datetime import datetime

from sqlalchemy.orm import Session

from app.models.scan import Scan
from app.models.website import Website


def create_scan(db: Session, website_id: int, engine: str):
    website = (
        db.query(Website)
        .filter(Website.id == website_id)
        .first()
    )

    if website is None:
        return None

    scan = Scan(
        website_id=website.id,
        engine=engine,
        target=website.url,
        status="Pending",
        findings=0,
        risk_score=0,
    )

    db.add(scan)
    db.commit()
    db.refresh(scan)

    return scan


def update_scan_status(
    db: Session,
    scan_id: int,
    status: str,
):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()

    if scan is None:
        return None

    scan.status = status

    if status == "Completed":
        scan.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(scan)

    return scan


def save_scan_result(
    db: Session,
    scan_id: int,
    findings: int,
    risk_score: int,
    raw_output: str,
    parsed_output: dict,
):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()

    if scan is None:
        return None

    scan.findings = findings
    scan.risk_score = risk_score
    scan.raw_output = raw_output
    scan.parsed_output = parsed_output
    scan.status = "Completed"
    scan.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(scan)

    return scan


def get_scan(db: Session, scan_id: int):
    return (
        db.query(Scan)
        .filter(Scan.id == scan_id)
        .first()
    )


def get_scan_history(
    db: Session,
    website_id: int,
):
    return (
        db.query(Scan)
        .filter(Scan.website_id == website_id)
        .order_by(Scan.created_at.desc())
        .all()
    )


def get_all_scans(db: Session):
    """Return every scan, newest first."""
    return (
        db.query(Scan)
        .order_by(Scan.created_at.desc())
        .all()
    )


def delete_scan(db: Session, scan_id: int):
    """Delete a scan record. Returns True if deleted, False if not found."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()

    if scan is None:
        return False

    db.delete(scan)
    db.commit()

    return True