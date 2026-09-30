"""Managed bounded scan job dispatch and cancellation.

Design (defensive hardening):
- Manual scans are queued as durable ``Scan`` rows (status ``Pending``); this
  module runs one small bounded dispatch loop instead of a daemon thread per
  request.
- Jobs are claimed atomically with a compare-and-set on
  ``status/worker_id/version`` so cancelled or already-claimed jobs are never
  executed twice, and the adapter keeps the claim for every subsequent write.
- On startup, scans interrupted by a previous process are marked ``Failed``
  once. There is no auto replay or retry.
- Concurrency is bounded by ``SENTINEL_SCAN_WORKERS`` (default 2, max 16).
- Cancel is compare-and-set: a completing worker can never overwrite a
  ``Cancelled`` terminal row. Cooperative subprocess termination is
  best-effort, Windows-safe, and not an isolation guarantee.
"""
import logging
import os
import threading
import uuid
from datetime import datetime, timedelta

from app.models.scan import Scan
from app.utils.scanner_utils import redact_text

logger = logging.getLogger("sentinel.scanner_worker")

CANCELLABLE_STATUSES = ("Pending", "Running")
TERMINAL_STATUSES = ("Completed", "Failed", "Cancelled")
CLAIM_STALENESS = timedelta(minutes=30)

_worker_threads: list[threading.Thread] = []
_wake_event = threading.Event()
_stop_event = threading.Event()
_shutdown_timeout = 20  # seconds; bounded graceful drain


def stopping() -> bool:
    """True while the pool is shutting down; adapters check it between steps."""
    return _stop_event.is_set()


def _worker_count() -> int:
    raw = (os.getenv("SENTINEL_SCAN_WORKERS") or "2").strip()
    try:
        count = int(raw)
    except ValueError:
        count = 2
    return max(1, min(count, 16))


def _utcnow() -> datetime:
    return datetime.utcnow()


def enqueue_scan(scan_id: int) -> None:
    """Wake the bounded dispatch loop for a queued (already committed) scan."""
    del scan_id  # The durable Scan row is the queue; this only nudges latency.
    _wake_event.set()


def request_cancel(scan_id: int) -> bool:
    """Cooperative wake so the dispatch loop notices a cancelled job sooner."""
    del scan_id
    _wake_event.set()
    return True


def _recover_interrupted_scans() -> int:
    """Mark scans from a previous process as Failed once (no replay/retry)."""
    from app.database.database import SessionLocal

    db = SessionLocal()
    recovered = 0
    try:
        db.info["system_scope"] = True
        stale = db.query(Scan).filter(Scan.status.in_(CANCELLABLE_STATUSES)).all()
        now = _utcnow()
        for scan in stale:
            scan.status = "Failed"
            scan.completed_at = now
            scan.heartbeat_at = None
            scan.worker_id = None
            scan.error = redact_text(
                "Scan was interrupted by a service restart and is not retried "
                "automatically; re-run the scan manually."
            )
            recovered += 1
        db.commit()
        if recovered:
            logger.warning("Startup recovery marked %s interrupted scan(s) as Failed.", recovered)
    except Exception:
        db.rollback()
        logger.exception("Startup scan recovery could not complete.")
    finally:
        db.info.pop("system_scope", None)
        db.close()
    return recovered


def _claim_next_job(worker_id: str) -> int | None:
    """Atomically claim one Pending scan with a compare-and-set update."""
    from app.database.database import SessionLocal

    db = SessionLocal()
    try:
        db.info["system_scope"] = True
        candidate = (
            db.query(Scan)
            .filter(Scan.status == "Pending", Scan.worker_id.is_(None))
            .order_by(Scan.created_at.asc(), Scan.id.asc())
            .first()
        )
        if candidate is None:
            return None
        updated = (
            db.query(Scan)
            .filter(
                Scan.id == candidate.id,
                Scan.status == "Pending",
                Scan.worker_id.is_(None),
                Scan.version == candidate.version,
            )
            .update(
                {
                    "status": "Running",
                    "worker_id": worker_id,
                    "heartbeat_at": _utcnow(),
                    "version": candidate.version + 1,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        return candidate.id if updated else None
    except Exception:
        db.rollback()
        logger.exception("Scan claim failed.")
        return None
    finally:
        db.info.pop("system_scope", None)
        db.close()


def _worker_loop(worker_id: str) -> None:
    logger.info("Scan worker %s started.", worker_id)
    while not _stop_event.is_set():
        scan_id = None
        try:
            scan_id = _claim_next_job(worker_id)
        except Exception:
            logger.exception("Scan dispatch error.")
        if scan_id is None:
            _wake_event.wait(timeout=0.5)
            _wake_event.clear()
            continue
        try:
            engine = None
            from app.database.database import SessionLocal
            bootstrap = SessionLocal()
            try:
                bootstrap.info["system_scope"] = True
                row = bootstrap.query(Scan.engine).filter(Scan.id == scan_id).first()
                engine = row[0] if row else None
            finally:
                bootstrap.close()
            if engine is None:
                continue
            from app.services.scanners.scanner_factory import ScannerFactory
            scanner = ScannerFactory.get_scanner(engine)
            scanner.start_scan(scan_id, worker_id=worker_id)
        except TypeError:
            _fail_job(scan_id, "Scanner adapter does not support managed job claims.")
        except Exception as exc:
            logger.exception("Scan execution error for scan %s.", scan_id)
            _fail_job(scan_id, f"Scanner dispatch error: {redact_text(str(exc))}")
    logger.info("Scan worker %s stopped.", worker_id)


def _fail_job(scan_id: int, message: str) -> None:
    """Compare-and-set terminal failure for a claimed job."""
    from app.database.database import SessionLocal

    db = SessionLocal()
    try:
        db.info["system_scope"] = True
        db.query(Scan).filter(
            Scan.id == scan_id, Scan.status.in_(CANCELLABLE_STATUSES)
        ).update(
            {
                "status": "Failed",
                "error": redact_text(message)[:4000],
                "completed_at": _utcnow(),
                "heartbeat_at": None,
            },
            synchronize_session=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Terminal failure update failed for scan %s.", scan_id)
    finally:
        db.info.pop("system_scope", None)
        db.close()


def start_scan_workers() -> None:
    """Start the bounded worker pool and run one-shot startup recovery.

    Idempotent. No auto replay or retry: interrupted scans are marked Failed.
    """
    global _worker_threads
    if _worker_threads:
        return
    _stop_event.clear()
    _recover_interrupted_scans()
    count = _worker_count()
    for index in range(count):
        thread = threading.Thread(
            target=_worker_loop, args=(uuid.uuid4().hex,), name=f"scan-worker-{index}", daemon=False
        )
        thread.start()
        _worker_threads.append(thread)
    logger.info("Started %s scan worker(s).", count)


def stop_scan_workers() -> None:
    """Signal workers to stop after their current job; bounded join."""
    global _worker_threads
    _stop_event.set()
    _wake_event.set()
    for thread in list(_worker_threads):
        thread.join(timeout=_shutdown_timeout)
    _worker_threads = [thread for thread in _worker_threads if thread.is_alive()]
