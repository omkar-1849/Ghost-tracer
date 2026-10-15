"""Durable database-backed AI Analysis job queue worker.

Implements compare-and-set claim protocol, lease-based crash recovery,
exponential backoff, circuit breaking, stale-writer fencing, and tenant-scoped
execution.
"""
import logging
import random
import threading
import uuid
from datetime import datetime, timedelta
from typing import Optional

import httpx
from sqlalchemy import and_, or_

from app.config.runtime import get_runtime_config
from app.database.database import SessionLocal
from app.models.ai_analysis_job import AiAnalysisJob
from app.models.event import Event
from app.schemas.ai_analyst_schema import AIAnalystInput, AIAnalystResponse

logger = logging.getLogger("sentinel.ai_worker")

_worker_threads: list[threading.Thread] = []
_wake_event = threading.Event()
_stop_event = threading.Event()
_circuit_breaker_failures = 0
_breaker_cooldown_until: Optional[datetime] = None


def stopping() -> bool:
    return _stop_event.is_set()


def wake_ai_worker() -> None:
    _wake_event.set()


def _parse_backoff_delays(backoff_str: str) -> list[int]:
    try:
        delays = [int(x.strip()) for x in backoff_str.split(",") if x.strip()]
        return delays if delays else [30, 120, 600]
    except Exception:
        return [30, 120, 600]


def _call_gt_beta_inference(config, analyst_input: AIAnalystInput) -> tuple[bool, Optional[dict], str]:
    """Execute HTTP call to GT-Beta inference server without any DB transaction.
    
    Returns (success: bool, result_dict_or_None, error_code: str).
    """
    url = config.ai_analyst_url
    timeout = config.ai_analyst_timeout
    payload = {"event": analyst_input.model_dump(mode="json")}

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload)
            if resp.status_code >= 400 and resp.status_code < 500:
                logger.warning("AI Analyst returned non-retryable 4xx client error: %d", resp.status_code)
                return False, None, f"HTTP_{resp.status_code}"
            resp.raise_for_status()
            data = resp.json()

            if not isinstance(data, dict):
                return False, None, "BAD_RESPONSE"

            raw_conf = float(data.get("confidence", 0.0))
            norm_conf = raw_conf / 100.0 if raw_conf > 1.0 else raw_conf
            norm_conf = min(max(norm_conf, 0.0), 1.0)

            # Parse and validate schema with default safety guarantees
            parsed_response = AIAnalystResponse(
                decision=data.get("decision", "MONITOR"),
                action_type=data.get("action_type"),
                target=data.get("target"),
                confidence=norm_conf,
                threat_level=data.get("threat_level", "LOW"),
                reason=data.get("reason", "No reason provided by model"),
                recommended_actions=data.get("recommended_actions", []),
                requires_approval=True,
                source_ip_trusted=False,
                engine="gt-beta-http",
                attack_type=data.get("attack_type"),
                evidence=data.get("evidence"),
            )
            return True, parsed_response.model_dump(mode="json"), "OK"

    except httpx.TimeoutException:
        logger.warning("AI Analyst request timed out after %ds", timeout)
        return False, None, "TIMEOUT"
    except httpx.ConnectError:
        logger.warning("AI Analyst connection refused/unreachable")
        return False, None, "UNAVAILABLE"
    except Exception as exc:
        logger.warning("AI Analyst inference failed: %s", exc)
        return False, None, "BAD_RESPONSE"


def _sweep_stale_jobs_on_disabled(db) -> None:
    """When AI is disabled, mark leftover PENDING jobs as SKIPPED so they don't linger."""
    now = datetime.utcnow()
    db.info["system_scope"] = True
    stale_jobs = db.query(AiAnalysisJob).filter(AiAnalysisJob.status == "PENDING").all()
    for job in stale_jobs:
        job.status = "FAILED"
        job.last_error_code = "AI_DISABLED"
        job.completed_at = now
        job.updated_at = now
        # Update event status
        event = db.query(Event).filter(Event.id == job.event_id).first()
        if event and event.ai_status == "PENDING":
            event.ai_status = "SKIPPED"
            event.ai_completed_at = now
    db.commit()


def _recover_disabled_jobs_on_enabled(db) -> int:
    """When AI is re-enabled, reactivate jobs that were skipped due to AI_DISABLED."""
    now = datetime.utcnow()
    db.info["system_scope"] = True
    disabled_jobs = db.query(AiAnalysisJob).filter(
        AiAnalysisJob.status == "FAILED",
        AiAnalysisJob.last_error_code == "AI_DISABLED",
    ).all()
    recovered_count = 0
    for job in disabled_jobs:
        job.status = "PENDING"
        job.last_error_code = None
        job.completed_at = None
        job.available_at = now
        job.updated_at = now
        event = db.query(Event).filter(Event.id == job.event_id).first()
        if event and event.ai_status == "SKIPPED":
            event.ai_status = "PENDING"
            event.ai_completed_at = None
        recovered_count += 1
    if recovered_count > 0:
        db.commit()
        logger.info("Reactivated %d AI jobs previously skipped while AI was disabled", recovered_count)
    return recovered_count


def _ai_worker_loop() -> None:
    global _circuit_breaker_failures, _breaker_cooldown_until

    config = get_runtime_config()
    backoff_delays = _parse_backoff_delays(config.ai_job_backoff_seconds)
    lease_seconds = config.ai_job_lease_seconds
    max_attempts = config.ai_job_max_attempts

    while not _stop_event.is_set():
        now = datetime.utcnow()

        # Circuit breaker check
        if _breaker_cooldown_until and now < _breaker_cooldown_until:
            _stop_event.wait(timeout=2.0)
            continue

        db = SessionLocal()
        claimed_job_id = None
        claim_token = None
        claimed_job_org = None
        claimed_event_id = None
        analyst_input = None

        try:
            db.info["system_scope"] = True

            # 1. Discover candidates (portable SELECT without exclusive locking)
            candidate_ids = [
                r[0]
                for r in db.query(AiAnalysisJob.id)
                .filter(
                    or_(
                        and_(AiAnalysisJob.status == "PENDING", AiAnalysisJob.available_at <= now),
                        and_(AiAnalysisJob.status == "RUNNING", AiAnalysisJob.locked_until < now),
                    )
                )
                .order_by(AiAnalysisJob.priority.desc(), AiAnalysisJob.available_at.asc(), AiAnalysisJob.id.asc())
                .limit(5)
                .all()
            ]

            # 2. Attempt CAS Claim for one candidate
            for cand_id in candidate_ids:
                token = uuid.uuid4().hex
                lock_until = now + timedelta(seconds=lease_seconds)

                rows = (
                    db.query(AiAnalysisJob)
                    .filter(
                        AiAnalysisJob.id == cand_id,
                        or_(
                            AiAnalysisJob.status == "PENDING",
                            and_(AiAnalysisJob.status == "RUNNING", AiAnalysisJob.locked_until < now),
                        ),
                    )
                    .update(
                        {
                            "status": "RUNNING",
                            "lease_token": token,
                            "locked_until": lock_until,
                            "attempts": AiAnalysisJob.attempts + 1,
                            "started_at": now,
                            "updated_at": now,
                        },
                        synchronize_session=False,
                    )
                )
                db.commit()

                if rows == 1:
                    claimed_job_id = cand_id
                    claim_token = token
                    break

            if not claimed_job_id:
                # Nothing to do; sleep or wait for wake signal
                db.close()
                _wake_event.wait(timeout=3.0)
                _wake_event.clear()
                continue

            # 3. Load claimed job and check poison limits
            job = db.query(AiAnalysisJob).filter(AiAnalysisJob.id == claimed_job_id).first()
            if not job:
                db.close()
                continue

            claimed_job_org = job.organization_id
            claimed_event_id = job.event_id

            if job.attempts > max_attempts:
                # Poison job guard: mark FAILED
                job.status = "FAILED"
                job.last_error_code = "MAX_ATTEMPTS"
                job.completed_at = now
                job.updated_at = now
                event = db.query(Event).filter(Event.id == claimed_event_id, Event.organization_id == claimed_job_org).first()
                if event:
                    event.ai_status = "FAILED"
                    event.ai_completed_at = now
                db.commit()
                db.close()
                continue

            # 4. Load event and build AI request payload
            event = db.query(Event).filter(Event.id == claimed_event_id, Event.organization_id == claimed_job_org).first()
            if not event:
                job.status = "FAILED"
                job.last_error_code = "EVENT_GONE"
                job.completed_at = now
                job.updated_at = now
                db.commit()
                db.close()
                continue

            # Extract inputs from event
            det_result = event.detection_result or {}
            canonical_data = det_result.get("canonical_event")
            if not canonical_data:
                canonical_data = {
                    "event_id": event.client_event_id,
                    "timestamp": event.created_at.isoformat() if event.created_at else now.isoformat(),
                    "source": event.source,
                    "source_type": "web",
                    "event_type": event.event_type,
                    "severity": event.severity,
                    "src_ip": event.ip_address,
                    "user_agent": event.user_agent,
                    "title": event.title,
                    "description": event.description,
                    "metadata": event.event_metadata or {},
                }
            det_data = {k: v for k, v in det_result.items() if k != "canonical_event"}
            risk_data = det_result.get("risk", {"threat_level": event.threat_level, "risk_score": event.risk_score or 0})
            analyst_input = AIAnalystInput(event=canonical_data, detection=det_data, risk=risk_data)

            # Close DB session before HTTP inference
            db.close()
            db = None

        except Exception as exc:
            logger.error("Error claiming or preparing AI job: %s", exc)
            if db:
                db.rollback()
                db.close()
            _stop_event.wait(timeout=1.0)
            continue

        # 5. Out-of-band HTTP Call (No DB connection held)
        success, result_dict, err_code = _call_gt_beta_inference(config, analyst_input)

        # 6. Complete Job in Short Dedicated Transaction
        db = SessionLocal()
        try:
            db.info["system_scope"] = True
            now = datetime.utcnow()

            if success:
                _circuit_breaker_failures = 0
                _breaker_cooldown_until = None

                # Stale-writer fencing: ensure lease_token still matches
                updated = (
                    db.query(AiAnalysisJob)
                    .filter(
                        AiAnalysisJob.id == claimed_job_id,
                        AiAnalysisJob.lease_token == claim_token,
                        AiAnalysisJob.status == "RUNNING",
                    )
                    .update(
                        {
                            "status": "SUCCEEDED",
                            "completed_at": now,
                            "updated_at": now,
                        },
                        synchronize_session=False,
                    )
                )

                if updated == 1:
                    # Update Event row in same tenant
                    db.query(Event).filter(
                        Event.id == claimed_event_id,
                        Event.organization_id == claimed_job_org,
                        Event.ai_status == "PENDING",
                    ).update(
                        {
                            "analyst_result": result_dict,
                            "ai_status": "COMPLETED",
                            "ai_completed_at": now,
                        },
                        synchronize_session=False,
                    )
                    db.commit()
                else:
                    logger.warning("Lost lease on job %d; completion skipped", claimed_job_id)
                    db.rollback()

            else:
                # Handle Failure / Backoff
                is_non_retryable = err_code.startswith("HTTP_4") or err_code == "EVENT_GONE"

                if not is_non_retryable:
                    _circuit_breaker_failures += 1
                    if _circuit_breaker_failures >= config.ai_breaker_failures:
                        cooldown_secs = config.ai_breaker_cooldown_seconds
                        _breaker_cooldown_until = now + timedelta(seconds=cooldown_secs)
                        logger.warning(
                            "AI Circuit breaker tripped (%d failures). Pausing claims for %ds",
                            _circuit_breaker_failures,
                            cooldown_secs,
                        )

                # Determine if terminal
                job = db.query(AiAnalysisJob).filter(AiAnalysisJob.id == claimed_job_id).first()
                attempts = job.attempts if job else 1

                if is_non_retryable or attempts >= max_attempts:
                    # Terminal failure
                    db.query(AiAnalysisJob).filter(
                        AiAnalysisJob.id == claimed_job_id,
                        AiAnalysisJob.lease_token == claim_token,
                    ).update(
                        {
                            "status": "FAILED",
                            "last_error_code": err_code,
                            "completed_at": now,
                            "updated_at": now,
                        },
                        synchronize_session=False,
                    )
                    db.query(Event).filter(
                        Event.id == claimed_event_id,
                        Event.organization_id == claimed_job_org,
                        Event.ai_status == "PENDING",
                    ).update(
                        {
                            "ai_status": "FAILED",
                            "ai_completed_at": now,
                        },
                        synchronize_session=False,
                    )
                    db.commit()
                else:
                    # Retry with exponential backoff + jitter
                    idx = min(attempts - 1, len(backoff_delays) - 1)
                    delay = backoff_delays[idx] + random.uniform(0, 5)
                    next_avail = now + timedelta(seconds=delay)

                    db.query(AiAnalysisJob).filter(
                        AiAnalysisJob.id == claimed_job_id,
                        AiAnalysisJob.lease_token == claim_token,
                    ).update(
                        {
                            "status": "PENDING",
                            "available_at": next_avail,
                            "lease_token": None,
                            "locked_until": None,
                            "last_error_code": err_code,
                            "updated_at": now,
                        },
                        synchronize_session=False,
                    )
                    db.commit()

        except Exception as exc:
            logger.error("Error finalizing AI analysis job: %s", exc)
            db.rollback()
        finally:
            db.close()


def start_ai_workers() -> None:
    config = get_runtime_config()
    if not config.ai_analyst_enabled:
        # Sweep any orphaned PENDING jobs to SKIPPED
        try:
            db = SessionLocal()
            _sweep_stale_jobs_on_disabled(db)
            db.close()
        except Exception as exc:
            logger.warning("Could not sweep jobs on disabled AI: %s", exc)
        return

    # If AI is enabled, recover any jobs that were temporarily skipped while AI was disabled
    try:
        db = SessionLocal()
        _recover_disabled_jobs_on_enabled(db)
        db.close()
    except Exception as exc:
        logger.warning("Could not recover previously skipped AI jobs: %s", exc)

    if not config.ai_worker_embedded:
        logger.info("Embedded AI worker disabled (AI_WORKER_EMBEDDED=false)")
        return

    concurrency = config.ai_worker_concurrency
    _stop_event.clear()
    _wake_event.clear()

    for i in range(concurrency):
        t = threading.Thread(target=_ai_worker_loop, name=f"sentinel-ai-worker-{i}", daemon=True)
        t.start()
        _worker_threads.append(t)
    logger.info("Started %d AI worker threads", concurrency)


def stop_ai_workers(timeout: float = 10.0) -> None:
    _stop_event.set()
    _wake_event.set()
    for t in _worker_threads:
        t.join(timeout=timeout)
    _worker_threads.clear()
    logger.info("AI workers stopped")
