"""
Background worker for scan execution.

Provides a generic entry point that dispatches to the correct scanner
engine via the ScannerFactory.  Used by FastAPI BackgroundTasks and
threading dispatchers alike.
"""

from app.database.database import SessionLocal
from app.models.scan import Scan
from app.services.scanners.scanner_factory import ScannerFactory
from app.utils.scanner_utils import ist_now


def run_scan_background(scan_id: int, engine: str) -> None:
    """
    Execute a scan in the background.

    This function is designed to be called from FastAPI BackgroundTasks
    or a daemon thread.  It delegates to the appropriate scanner via
    the ScannerFactory.

    Each scanner's ``start_scan`` manages its own DB session internally,
    but we handle top-level dispatch errors here to guarantee the Scan
    record is always updated.
    """
    try:
        scanner = ScannerFactory.get_scanner(engine)
        scanner.start_scan(scan_id)
    except ValueError as e:
        # Unknown engine — mark the scan as failed
        db = SessionLocal()
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if scan:
                scan.status = "Failed"
                scan.error = str(e)
                scan.completed_at = ist_now()
                db.commit()
        except Exception:
            pass
        finally:
            db.close()
    except Exception as e:
        # Unexpected top-level error
        db = SessionLocal()
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if scan and scan.status not in ("Completed", "Failed"):
                scan.status = "Failed"
                scan.error = f"Scanner dispatch error: {str(e)[:3900]}"
                scan.completed_at = ist_now()
                db.commit()
        except Exception:
            pass
        finally:
            db.close()
