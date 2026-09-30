"""Process-local, bounded HMAC request buckets; no raw email/IP retained."""
import hashlib
import hmac
import os
import time
from functools import lru_cache
from threading import Lock

from fastapi import HTTPException, Request

from app.config.runtime import get_runtime_config


class RequestLimiter:
    def __init__(self, key: bytes, max_buckets: int = 10000, clock=time.monotonic):
        self.key = key
        self.max_buckets = max_buckets
        self.clock = clock
        self.buckets = {}
        self.lock = Lock()

    def allow(self, action: str, ip: str, email: str | None,
              ip_limit: int, email_limit: int, window: int) -> bool:
        identities = [("ip", ip, ip_limit)]
        if email:
            identities.append(("email", email.strip().lower(), email_limit))
        keys = [(hmac.new(self.key, (action + "\0" + kind + "\0" + value).encode(),
                          hashlib.sha256).digest(), limit)
                for kind, value, limit in identities]
        now = self.clock()
        with self.lock:
            # Each entry has its own expiry; overflow fails closed until expiry.
            for key in [k for k, (_, expiry) in self.buckets.items() if expiry <= now]:
                del self.buckets[key]
            new_keys = sum(key not in self.buckets for key, _ in keys)
            if len(self.buckets) + new_keys > self.max_buckets:
                return False
            allowed = all(self.buckets.get(key, (0, 0))[0] < limit for key, limit in keys)
            for key, limit in keys:
                count, expiry = self.buckets.get(key, (0, now + window))
                self.buckets[key] = (min(count + 1, limit), expiry)
            return allowed


def _integer(name: str, default: int, maximum: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
        if not 1 <= value <= maximum:
            raise ValueError
        return value
    except ValueError:
        raise ValueError(name + " must be a positive integer within the supported bound.") from None


@lru_cache(maxsize=1)
def get_request_limiter() -> RequestLimiter:
    # Domain separation avoids reusing the signing key directly as an HMAC key.
    key = hmac.new(get_runtime_config().jwt_secret.encode(), b"sentinel-request-limiter-v1",
                   hashlib.sha256).digest()
    return RequestLimiter(key, _integer("AUTH_RATE_MAX_BUCKETS", 10000, 100000))


def check_rate_limit(request: Request, subject_email: str | None = None) -> bool:
    """Use socket peer only; forwarded headers are not trusted as client identity."""
    action = request.url.path
    recovery = action == "/auth/forgot-password"
    ip_limit = _integer("AUTH_RATE_IP_LIMIT", 30, 1000)
    email_limit = _integer("AUTH_RATE_EMAIL_LIMIT", 5, 100)
    window = _integer("AUTH_RATE_WINDOW_SECONDS", 900, 3600)
    allowed = get_request_limiter().allow(action, request.client.host if request.client else "unknown",
                                          subject_email, ip_limit, email_limit, window)
    if not allowed and not recovery:
        raise HTTPException(429, "Too many requests. Please try again later.",
                            headers={"Retry-After": str(window)})
    return allowed
