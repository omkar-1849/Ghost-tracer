"""Tenant-scoped scan persistence and terminal-state transitions.

All reads/writes go through the request session (auto tenant scope) or, in
workers, a session with ``db.info["organization_id"]`` set from the trusted
queued job. Status changes to terminal states are compare-and-set updates on
``status``/``version`` so racing completions, cancels, and deletes can never
overwrite each other (e.g. a Completed result can never overwrite Cancelled).
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.scan import Scan
from app.models.website import Website
from app.services.audit_log_service import create_audit_log

TERMINAL_STATUSES = ("Completed", "Failed", "Cancelled")


def _scan_audit_description(scan: Scan, action: str) -> str:
    if action == "SCAN_COMPLETED":
        return f"Scan ({scan.engine}) on {scan.target} completed with {scan.findings} findings."
    if action == "SCAN_FAILED":
        return f"Scan ({scan.engine}) on {scan.target} failed."
    return f"Scan ({scan.engine}) on {scan.target}: {scan.status}."


def _log_scan_event(db: Session, scan: Scan, action: str) -> None:
    from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id

    organization_id = scan.organization_id
    if organization_id is None:
        organization_id = resolve_audit_organization_id(db)
    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=None,
        action=action,
        resource_type="SCAN",
        resource_id=str(scan.id),
        description=_scan_audit_description(scan, action),
    )


def create_scan(db: Session, website_id: int, engine: str) -> Scan:
    """Create a Pending scan for a verified website in the request tenant.

    The request session is tenant-scoped; the write validator enforces that the
    website belongs to the same organization. The scan is committed here so the
    durable job record exists before any dispatch notification.
    """
    website = (
        db.query(Website)
        .filter(Website.id == website_id)
        .first()
    )

    if website is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Website not found.")

    if not website.verified:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="Website ownership has not been verified.",
        )

    from app.utils.destination import validate_destination
    from fastapi import HTTPException
    import os
    destination = validate_destination(website.url)
    if (website.verified_target != destination.url
            or set(website.verified_addresses or []) != set(destination.addresses)):
        raise HTTPException(403, "Website destination changed; verify ownership again.")
    if engine not in ('ssl', 'nmap', 'nikto', 'nuclei', 'sqlmap', 'zap'):
        raise HTTPException(400, "Unsupported scanner engine.")
    limit = max(1, min(int(os.getenv('SENTINEL_SCAN_QUEUE_LIMIT', '100')), 1000))
    if db.query(Scan).filter(Scan.status.in_(("Pending", "Running"))).count() >= limit:
        raise HTTPException(429, "This organization's manual scan queue is full.")
    scan = Scan(
        organization_id=website.organization_id,
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

    _log_scan_event(db, scan, "SCAN_STARTED")

    return scan


def get_scan(db: Session, scan_id: int):
    return (
        db.query(Scan)
        .filter(Scan.id == scan_id)
        .first()
    )


def get_scan_history(db: Session, website_id: int):
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


def transition_scan_status(
    db: Session,
    scan_id: int,
    new_status: str,
    expected_statuses: tuple = ("Pending", "Running"),
    *,
    system_scope: bool = False,
) -> Scan | None:
    """
    Compare-and-set status transition guarded to ``expected_statuses``.

    Terminal states (Completed/Failed/Cancelled) are write-once: a transition
    from a terminal state is refused unless it is the identical no-op. Used by
    both the API (cancel) and workers (results) to serialize terminal state.
    """
    from app.database.database import SessionLocal

    if system_scope:
        db.info["system_scope"] = True
    try:
        now = datetime.utcnow()
        if new_status in TERMINAL_STATUSES:
            updated = (
                db.query(Scan)
                .filter(Scan.id == scan_id, Scan.status.in_(expected_statuses))
                .update(
                    {
                        "status": new_status,
                        "completed_at": now,
                        "heartbeat_at": None,
                        "version": Scan.version + 1,
                    },
                    synchronize_session=False,
                )
            )
            db.commit()
            if not updated:
                return None
        else:
            updated = (
                db.query(Scan)
                .filter(Scan.id == scan_id, Scan.status.in_(expected_statuses))
                .update(
                    {
                        "status": new_status,
                        "version": Scan.version + 1,
                    },
                    synchronize_session=False,
                )
            )
            db.commit()
            if not updated:
                return None
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        return scan
    except Exception:
        db.rollback()
        raise
    finally:
        if system_scope:
            db.info.pop("system_scope", None)


def update_scan_status(
    db: Session,
    scan_id: int,
    status: str,
):
    """Legacy API write capability is intentionally denied."""
    from fastapi import HTTPException
    raise HTTPException(403, "Scan state is managed by trusted claimed workers only.")
    scan = transition_scan_status(
        db, scan_id, status,
        expected_statuses=("Pending", "Running")
        if status in ("Completed", "Failed", "Cancelled")
        else ("Pending", "Running", "Completed", "Failed", "Cancelled"),
    )
    if scan is None:
        return None
    if status == "Completed":
        _log_scan_event(db, scan, "SCAN_COMPLETED")
    elif status == "Failed":
        _log_scan_event(db, scan, "SCAN_FAILED")
    return scan


def save_scan_result(
    db: Session,
    scan_id: int,
    findings: int,
    risk_score: int,
    raw_output: str,
    parsed_output: dict,
    *,
    system_scope: bool = False,
    truncated: bool = False,
):
    """
    Persist final results and atomically mark the scan Completed.

    Only transitions from Pending/Running. If the scan was cancelled or already
    terminal, results are NOT applied (returns None) so cancellation always
    wins over a completing worker.
    """
    from app.database.database import SessionLocal

    if system_scope:
        db.info["system_scope"] = True
    try:
        updated = (
            db.query(Scan)
            .filter(Scan.id == scan_id, Scan.status.in_(("Pending", "Running")))
            .update(
                {
                    "findings": max(int(findings), 0),
                    "risk_score": max(int(risk_score), 0),
                    "raw_output": raw_output,
                    "parsed_output": parsed_output,
                    "truncated": bool(truncated),
                    "status": "Completed",
                    "completed_at": datetime.utcnow(),
                    "heartbeat_at": None,
                    "version": Scan.version + 1,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        if not updated:
            return None
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan is not None:
            _log_scan_event(db, scan, "SCAN_COMPLETED")
        return scan
    except Exception:
        db.rollback()
        raise
    finally:
        if system_scope:
            db.info.pop("system_scope", None)


def mark_scan_failed(
    db: Session,
    scan_id: int,
    error: str,
    *,
    system_scope: bool = False,
) -> Scan | None:
    """
    Compare-and-set transition to Failed from Pending/Running. Errors are
    redacted by the caller (scanner_utils.redact_text) before storage.
    """
    from app.database.database import SessionLocal

    if system_scope:
        db.info["system_scope"] = True
    try:
        updated = (
            db.query(Scan)
            .filter(Scan.id == scan_id, Scan.status.in_(("Pending", "Running")))
            .update(
                {
                    "status": "Failed",
                    "error": (error or "Scan failed.")[:4000],
                    "completed_at": datetime.utcnow(),
                    "heartbeat_at": None,
                    "version": Scan.version + 1,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        if not updated:
            return None
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan is not None:
            _log_scan_event(db, scan, "SCAN_FAILED")
        return scan
    except Exception:
        db.rollback()
        raise
    finally:
        if system_scope:
            db.info.pop("system_scope", None)


def delete_scan(db: Session, scan_id: int) -> bool:
    """Delete a terminal scan in the request tenant.

    Non-terminal scans are refused; they must be cancelled (or fail) first so a
    worker never writes into a deleted row's identity.
    """
    scan = get_scan(db, scan_id)
    if scan is None:
        return False
    if scan.status not in TERMINAL_STATUSES:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=409,
            detail="Only completed, failed, or cancelled scans can be deleted. Cancel the scan first.",
        )
    db.delete(scan)
    db.commit()
    return True
