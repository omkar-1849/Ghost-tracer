import threading

from sqlalchemy.orm import Session

from app.models.scan import Scan
from app.services.scan_service import create_scan
from app.services.scanners.scanner_factory import ScannerFactory
from app.utils.scanner_utils import ist_now

CANCELLABLE_STATUSES = ("Pending", "Running")

VALID_ENGINES = ("nmap", "nuclei", "sqlmap", "nikto", "zap", "ssl")


def run_scan(
    db: Session,
    website_id: int,
    engine: str = "nmap",
):
    """
    Create a Scan record and dispatch execution in a background thread.

    Uses the Scan model as the single source of truth.
    """
    if engine.lower() not in VALID_ENGINES:
        raise ValueError(
            f"Unsupported engine: {engine}. "
            f"Choose from: {', '.join(VALID_ENGINES)}"
        )

    scan = create_scan(db, website_id, engine.lower())

    if scan is None:
        return None

    scanner = ScannerFactory.get_scanner(engine)
    threading.Thread(
        target=scanner.start_scan,
        args=(scan.id,),
        daemon=True,
    ).start()

    return scan


# Backward compatibility alias
def run_sqlmap_scan(
    db: Session,
    target: str = "",
    engine: str = "sqlmap",
    website_id: int = None,
):
    """
    Legacy wrapper — preserved for backward compatibility.
    Prefer run_scan() for new code.
    """
    if website_id is not None:
        return run_scan(db, website_id, engine)

    # Fallback: create scan record directly if only target is provided
    scan = Scan(
        website_id=0,
        engine=engine.lower(),
        target=target,
        status="Pending",
        findings=0,
        risk_score=0,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scanner = ScannerFactory.get_scanner(engine)
    threading.Thread(
        target=scanner.start_scan,
        args=(scan.id,),
        daemon=True,
    ).start()

    return scan


def cancel_scan(db: Session, scan_id: int):
    """Cancel a pending or running scan."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()

    if not scan:
        return None

    if scan.status not in CANCELLABLE_STATUSES:
        return scan

    scan.status = "Cancelled"
    scan.completed_at = ist_now()

    db.commit()
    db.refresh(scan)

    return scan
