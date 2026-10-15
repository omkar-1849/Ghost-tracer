"""HTTP Client for Sentinel API endpoints using Python standard library.

Provides secure TLS communication, gzip compression, and error classification.
Never logs credentials or enrollment tokens.
"""

import gzip
import json
import logging
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("sentinel_collector.client")


class SentinelAPIError(Exception):
    """Base exception for Sentinel API interactions."""

    def __init__(self, message: str, status_code: Optional[int] = None, retry_after: int = 1):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after = retry_after


class AuthError(SentinelAPIError):
    """Raised when credential is revoked, invalid, or expired (HTTP 401)."""
    pass


class RateLimitError(SentinelAPIError):
    """Raised when request is rate limited (HTTP 429), carries retry_after."""

    def __init__(self, retry_after: int = 1):
        super().__init__(f"Rate limited by server, retry after {retry_after}s", status_code=429, retry_after=retry_after)


class SentinelClient:
    """Zero-dependency HTTP client for interacting with Sentinel telemetry endpoints."""

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        timeout: float = 10.0,
        ssl_context: Optional[ssl.SSLContext] = None,
        allow_insecure_http: bool = False,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.ssl_context = ssl_context or ssl.create_default_context()
        self.allow_insecure_http = allow_insecure_http
        self._validate_url_scheme()

    def _validate_url_scheme(self):
        parsed = urllib.parse.urlparse(self.base_url)
        scheme = parsed.scheme.lower()
        if scheme == "https":
            return
        if scheme == "http":
            host = (parsed.hostname or "").lower()
            is_loopback = host in ("127.0.0.1", "localhost", "::1", "0.0.0.0", "testserver")
            if is_loopback or self.allow_insecure_http:
                return
            raise ValueError(
                f"Insecure plaintext HTTP is forbidden for remote server '{host}'. "
                "Use HTTPS or pass allow_insecure_http=True."
            )
        raise ValueError(f"Unsupported URL scheme '{scheme}'. Must be http or https.")

    def _request(
        self,
        endpoint: str,
        method: str = "POST",
        headers: Optional[Dict[str, str]] = None,
        data: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        req_headers = {
            "Accept": "application/json",
            "User-Agent": "Sentinel-Collector/1.0.0",
        }
        if headers:
            req_headers.update(headers)

        req = urllib.request.Request(
            url=url,
            data=data,
            headers=req_headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self.ssl_context) as resp:
                resp_bytes = resp.read()
                if not resp_bytes:
                    return {}
                return json.loads(resp_bytes.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            status = exc.code
            err_body = ""
            try:
                err_body = exc.read().decode("utf-8", errors="replace")
            except Exception:
                pass

            if status == 401:
                raise AuthError("Credential revoked, invalid, or unauthorized (401)", status_code=401)
            elif status == 429:
                retry_header = exc.headers.get("Retry-After", "1")
                try:
                    retry_seconds = max(1, int(retry_header))
                except ValueError:
                    retry_seconds = 1
                raise RateLimitError(retry_after=retry_seconds)
            else:
                retry_header = exc.headers.get("Retry-After", "1")
                try:
                    retry_seconds = max(1, int(retry_header))
                except ValueError:
                    retry_seconds = 1
                raise SentinelAPIError(
                    f"HTTP {status} from Sentinel API: {err_body[:200]}",
                    status_code=status,
                    retry_after=retry_seconds,
                )
        except urllib.error.URLError as exc:
            raise SentinelAPIError(f"Network error connecting to Sentinel: {exc.reason}")
        except json.JSONDecodeError as exc:
            raise SentinelAPIError(f"Malformed JSON response from server: {exc}")

    def enroll(
        self,
        token: str,
        hostname: str,
        version: str,
        kind: str = "daemon",
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Enroll collector using single-use or multi-use enrollment token."""
        payload = {
            "kind": kind,
            "hostname": hostname,
            "version": version,
        }
        if name:
            payload["name"] = name

        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Enrollment-Token": token,
        }
        resp = self._request("/collector/enroll", method="POST", headers=headers, data=data)
        return resp

    def heartbeat(
        self,
        hostname: str,
        version: str,
    ) -> Dict[str, Any]:
        """Send periodic collector health heartbeat."""
        if not self.api_key:
            raise AuthError("Cannot send heartbeat without API key")
        payload = {
            "hostname": hostname,
            "version": version,
        }
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }
        return self._request("/collector/heartbeat", method="POST", headers=headers, data=data)

    def send_event_batch(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Send a batch of log records with gzip compression."""
        if not self.api_key:
            raise AuthError("Cannot send events without API key")
        if not items:
            return {"accepted": 0, "rejected": 0, "results": []}

        payload = {"items": items}
        raw_json = json.dumps(payload).encode("utf-8")
        compressed = gzip.compress(raw_json)

        headers = {
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
            "X-API-Key": self.api_key,
        }
        return self._request("/events/batch", method="POST", headers=headers, data=compressed)

