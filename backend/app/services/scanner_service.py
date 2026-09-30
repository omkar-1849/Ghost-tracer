"""Only manually requested, verified tenant website jobs may be dispatched."""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.scan import Scan
from app.services.scan_service import create_scan

CANCELLABLE_STATUSES = ('Pending', 'Running')
VALID_ENGINES = ('nmap', 'nuclei', 'sqlmap', 'nikto', 'zap', 'ssl')


def run_scan(db: Session, website_id: int, engine: str = 'nmap'):
    if engine.lower() not in VALID_ENGINES:
        raise ValueError('Unsupported scanner engine.')
    from app.services.scanner_worker import enqueue_scan
    scan = create_scan(db, website_id, engine.lower())
    enqueue_scan(scan.id)
    return scan


def run_sqlmap_scan(db, target='', engine='sqlmap', website_id=None):
    if website_id is None:
        raise ValueError('A verified tenant website_id is required; arbitrary targets are not accepted.')
    return run_scan(db, website_id, engine)


def cancel_scan(db: Session, scan_id: int):
    from app.services.scanner_worker import request_cancel
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if scan is None:
        return None
    db.query(Scan).filter(Scan.id == scan.id, Scan.organization_id == scan.organization_id,
                          Scan.status.in_(CANCELLABLE_STATUSES)).update({
        'status': 'Cancelled', 'completed_at': datetime.utcnow(), 'heartbeat_at': None,
        'version': Scan.version + 1}, synchronize_session=False)
    db.commit()
    db.refresh(scan)
    request_cancel(scan.id)
    return scan
