from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.scan import Scan
from app.models.website import Website
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id


def create_scan(db: Session, website_id: int, engine: str):
    website = (
        db.query(Website)
        .filter(Website.id == website_id)
        .first()
    )

    if website is None:
        raise HTTPException(
            status_code=404,
            detail="Website not found."
        )

    if not website.verified:
        raise HTTPException(
            status_code=403,
            detail="Website ownership has not been verified."
        )

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

    create_audit_log(
        db=db,
        organization_id=resolve_audit_organization_id(db),
        user_id=None,
        action="SCAN_STARTED",
        resource_type="SCAN",
        resource_id=str(scan.id),
        description=f"Scan started ({scan.engine}) on {scan.target}.",
    )

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

    if status == "Completed":
        create_audit_log(
            db=db,
            organization_id=resolve_audit_organization_id(db),
            user_id=None,
            action="SCAN_COMPLETED",
            resource_type="SCAN",
            resource_id=str(scan.id),
            description=f"Scan ({scan.engine}) on {scan.target} completed with {scan.findings} findings.",
        )
    elif status == "Failed":
        create_audit_log(
            db=db,
            organization_id=resolve_audit_organization_id(db),
            user_id=None,
            action="SCAN_FAILED",
            resource_type="SCAN",
            resource_id=str(scan.id),
            description=f"Scan ({scan.engine}) on {scan.target} failed.",
        )

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

    create_audit_log(
        db=db,
        organization_id=resolve_audit_organization_id(db),
        user_id=None,
        action="SCAN_COMPLETED",
        resource_type="SCAN",
        resource_id=str(scan.id),
        description=f"Scan ({scan.engine}) on {scan.target} completed with {scan.findings} findings.",
    )

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
    return (
        db.query(Scan)
        .order_by(Scan.created_at.desc())
        .all()
    )


def delete_scan(db: Session, scan_id: int):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()

    if scan is None:
        return False

    db.delete(scan)
    db.commit()

    return True