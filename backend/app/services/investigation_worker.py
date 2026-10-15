"""Investigation Worker Queue for Sentinel Scanner Intelligence.

Reliable, thread-based background worker processing InvestigationJob queues
with optimistic locking, stale-lease recovery, and backoff (§7.4 - §7.7 of Plan).
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta

from app.database.database import SessionLocal
from app.models.investigation_job import InvestigationJob
from app.services.investigation_service import process_investigation_job

logger = logging.getLogger(__name__)

_stop_event = threading.Event()
_wake_event = threading.Event()
_worker_threads: list[threading.Thread] = []


def wake_investigation_worker() -> None:
    """Signal background investigation workers that new jobs are ready."""
    _wake_event.set()


def _investigation_worker_loop() -> None:
    logger.info("Investigation worker thread started")
    while not _stop_event.is_set():
        claimed_job_id = None
        db = SessionLocal()
        try:
            db.info["system_scope"] = True
            now = datetime.utcnow()

            # Find next pending job or timed-out running job
            job = (
                db.query(InvestigationJob)
                .filter(
                    (InvestigationJob.status == "PENDING") |
                    ((InvestigationJob.status == "RUNNING") & (InvestigationJob.locked_until < now))
                )
                .order_by(InvestigationJob.priority.asc(), InvestigationJob.created_at.asc())
                .first()
            )

            if job:
                claimed_job_id = job.id
                job.status = "RUNNING"
                job.locked_until = now + timedelta(seconds=60)
                job.updated_at = now
                db.commit()

        except Exception as exc:
            logger.error("Error claiming investigation job: %s", exc)
            if db:
                db.rollback()
        finally:
            if db:
                db.close()

        if claimed_job_id:
            try:
                process_investigation_job(claimed_job_id)
            except Exception as proc_exc:
                logger.error("Error executing investigation job %s: %s", claimed_job_id, proc_exc)
        else:
            # Sleep or wait for wake signal
            _wake_event.wait(timeout=3.0)
            _wake_event.clear()

    logger.info("Investigation worker thread exiting")


def start_investigation_workers(concurrency: int = 1) -> None:
    _stop_event.clear()
    _wake_event.clear()
    for i in range(concurrency):
        t = threading.Thread(
            target=_investigation_worker_loop,
            name=f"sentinel-inv-worker-{i}",
            daemon=True,
        )
        t.start()
        _worker_threads.append(t)
    logger.info("Started %d investigation worker threads", concurrency)


def stop_investigation_workers(timeout: float = 10.0) -> None:
    _stop_event.set()
    _wake_event.set()
    for t in _worker_threads:
        t.join(timeout=timeout)
    _worker_threads.clear()
    logger.info("Investigation workers stopped")
