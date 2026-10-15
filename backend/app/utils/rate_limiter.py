import math
import threading
import time
from collections import defaultdict
from typing import Optional

from app.config.telemetry import TELEMETRY_RATE_LIMIT_ITEMS_PER_MINUTE

ENROLL_RATE_LIMIT_FAILURES_PER_WINDOW = 10
ENROLL_RATE_LIMIT_WINDOW_SECONDS = 300

_lock = threading.Lock()
_ip_failures = defaultdict(list)
_telemetry_buckets = {}


def check_enroll_rate_limit(
    ip: str,
    max_failures: int = ENROLL_RATE_LIMIT_FAILURES_PER_WINDOW,
    window_seconds: int = ENROLL_RATE_LIMIT_WINDOW_SECONDS,
) -> Optional[int]:
    """Check if the IP has exceeded allowed enrollment failure attempts.

    Returns retry_after in seconds if rate limited, or None if allowed.
    """
    now = time.time()
    with _lock:
        timestamps = _ip_failures[ip]
        # Prune older than window
        cutoff = now - window_seconds
        valid_ts = [t for t in timestamps if t > cutoff]
        _ip_failures[ip] = valid_ts
        if len(valid_ts) >= max_failures:
            oldest = valid_ts[0]
            retry_after = max(1, int(oldest + window_seconds - now))
            return retry_after
        return None


def record_enroll_failure(
    ip: str,
    window_seconds: int = ENROLL_RATE_LIMIT_WINDOW_SECONDS,
):
    """Record an enrollment failure for this IP."""
    now = time.time()
    with _lock:
        _ip_failures[ip].append(now)
        # Prune
        cutoff = now - window_seconds
        _ip_failures[ip] = [t for t in _ip_failures[ip] if t > cutoff]


def reset_enroll_limiter():
    """Clear in-memory rate limiter state (used in tests)."""
    with _lock:
        _ip_failures.clear()


def consume_telemetry_budget(
    integration_id: int,
    item_count: int = 1,
    limit_per_minute: int = TELEMETRY_RATE_LIMIT_ITEMS_PER_MINUTE,
) -> Optional[int]:
    """Consume item_count from the collector's token bucket budget.

    Returns retry_after in seconds if rate limited, or None if allowed.
    """
    now = time.time()
    capacity = float(limit_per_minute)
    refill_rate = capacity / 60.0

    with _lock:
        bucket = _telemetry_buckets.get(integration_id)
        if bucket is None:
            bucket = {"tokens": capacity, "last_update": now}
            _telemetry_buckets[integration_id] = bucket
        else:
            elapsed = now - bucket["last_update"]
            bucket["tokens"] = min(capacity, bucket["tokens"] + elapsed * refill_rate)
            bucket["last_update"] = now

        if bucket["tokens"] >= item_count:
            bucket["tokens"] -= item_count
            return None

        deficit = item_count - bucket["tokens"]
        wait_seconds = math.ceil(deficit / refill_rate) if refill_rate > 0 else 60
        return max(1, int(wait_seconds))


def reset_telemetry_limiter():
    """Clear in-memory telemetry rate limiter state (used in tests)."""
    with _lock:
        _telemetry_buckets.clear()
