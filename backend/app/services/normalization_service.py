from datetime import datetime, timezone
from ipaddress import ip_address
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import re
import urllib.parse

from app.schemas.event_schema import CanonicalSecurityEvent, bounded_metadata

NORMALIZATION_VERSION = 1
SEVERITY_MAP = {"info": "Info", "informational": "Info", "low": "Low", "medium": "Medium", "moderate": "Medium", "high": "High", "critical": "Critical"}
HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"}

JWT_PATTERN = re.compile(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b')
SENSITIVE_QUERY_KEYS = {
    "token", "access_token", "id_token", "refresh_token",
    "password", "passwd", "pwd", "secret", "api_key", "apikey", "key",
    "auth", "authorization", "jwt", "session", "sessionid", "sid",
    "code", "signature", "sig"
}


def redact_sensitive_url(url_val: Any) -> Any:
    """Redact sensitive query parameters and JWTs from URLs prior to persistence."""
    if not isinstance(url_val, str) or not url_val.strip():
        return url_val

    try:
        parsed = urlsplit(url_val)
        netloc = parsed.netloc
        if "@" in netloc:
            userinfo, hostport = netloc.rsplit("@", 1)
            if ":" in userinfo:
                user, _ = userinfo.split(":", 1)
                netloc = f"{user}:[REDACTED]@{hostport}"
            else:
                netloc = f"[REDACTED]@{hostport}"

        new_path = JWT_PATTERN.sub("[REDACTED_JWT]", parsed.path)

        if not parsed.query:
            if new_path != parsed.path or netloc != parsed.netloc:
                return urlunsplit((parsed.scheme, netloc, new_path, "", parsed.fragment))
            return url_val

        pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        redacted_pairs = []
        for k, v in pairs:
            if k.lower() in SENSITIVE_QUERY_KEYS or JWT_PATTERN.search(v):
                redacted_pairs.append((k, "[REDACTED]"))
            else:
                redacted_pairs.append((k, JWT_PATTERN.sub("[REDACTED_JWT]", v)))

        new_query = urllib.parse.urlencode(redacted_pairs)
        return urlunsplit((parsed.scheme, netloc, new_path, new_query, parsed.fragment))
    except Exception:
        return url_val


def redact_sensitive_text(text_val: Any) -> Any:
    """Redact JWTs and sensitive query patterns in freeform text/logs."""
    if not isinstance(text_val, str) or not text_val:
        return text_val

    text = JWT_PATTERN.sub("[REDACTED_JWT]", text_val)
    # Redact userinfo credentials in URLs like https://user:pass@host
    userinfo_pattern = re.compile(r'(https?://[^:\s@]+):([^\s@]+)@')
    text = userinfo_pattern.sub(r'\1:[REDACTED]@', text)
    param_pattern = re.compile(
        r'(?i)\b(' + '|'.join(re.escape(k) for k in SENSITIVE_QUERY_KEYS) + r')=([^\s&]+)'
    )
    text = param_pattern.sub(r'\1=[REDACTED]', text)
    return text


def redact_sensitive_metadata(meta: Any) -> Any:
    """Recursively redact sensitive query keys, URLs, userinfo passwords, and JWTs in metadata."""
    if isinstance(meta, dict):
        res = {}
        for k, v in meta.items():
            if k.lower() in SENSITIVE_QUERY_KEYS:
                res[k] = "[REDACTED]"
            elif isinstance(v, str) and (
                v.startswith("http://") or v.startswith("https://")
                or "url" in k.lower() or "uri" in k.lower()
                or k.lower() in ("path", "target", "referer")
            ):
                res[k] = redact_sensitive_url(v)
            else:
                res[k] = redact_sensitive_metadata(v)
        return res
    if isinstance(meta, list):
        return [redact_sensitive_metadata(v) for v in meta]
    if isinstance(meta, str):
        if meta.startswith("http://") or meta.startswith("https://"):
            return redact_sensitive_url(meta)
        return redact_sensitive_text(meta)
    return meta


def safe_text(value, limit=500):
    if not isinstance(value, str) or len(value) > limit or any(ord(c) < 32 or ord(c) == 127 for c in value):
        return None
    return value.strip() or None


def normalize_ip(value):
    text = safe_text(value, 50)
    if not text or "%" in text:
        return None
    try:
        return str(ip_address(text))
    except ValueError:
        return None


def normalize_method(value):
    text = safe_text(value, 10)
    return text.upper() if text and text.upper() in HTTP_METHODS else None


def normalize_status(value):
    if type(value) is str and value.isascii() and value.isdigit() and len(value) == 3:
        value = int(value)
    return value if type(value) is int and 100 <= value <= 599 else None


def normalize_url(value):
    text = safe_text(value, 2048)
    if not text:
        return None
    try:
        parsed = urlsplit(text)
        if not parsed.scheme and text.startswith("/") and not text.startswith("//"):
            return urlunsplit(("", "", parsed.path, parsed.query, ""))
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            return None
        hostname = parsed.hostname.lower().encode("idna").decode("ascii")
        if ":" in hostname:
            hostname = "[" + hostname + "]"
        port = parsed.port
        netloc = hostname + (f":{port}" if port else "")
        return urlunsplit((parsed.scheme.lower(), netloc, parsed.path or "/", parsed.query, ""))
    except (ValueError, UnicodeError):
        return None


def normalize_severity(severity):
    return SEVERITY_MAP.get(severity.strip().lower(), "Info") if isinstance(severity, str) else "Info"


def normalize_timestamp(timestamp: Any) -> datetime:
    value = timestamp if isinstance(timestamp, datetime) else datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def normalize_event(event: dict[str, Any]) -> CanonicalSecurityEvent:
    metadata = bounded_metadata(event.get("event_metadata", event.get("metadata", {})))

    def pick(*keys):
        for container in (event, metadata):
            for key in keys:
                if container.get(key) is not None:
                    return container[key]
        return None

    # No nested metadata is promoted into risk, confidence, provenance or policy.
    return CanonicalSecurityEvent(
        event_id=str(event["event_id"]) if event.get("event_id") is not None else None,
        timestamp=normalize_timestamp(event.get("timestamp") or event.get("created_at") or datetime.now(timezone.utc)),
        source=(safe_text(event.get("source"), 100) or "unknown").lower(),
        source_type=(safe_text(event.get("source_type") or event.get("source"), 100) or "unknown").lower(),
        event_type=(safe_text(event.get("event_type"), 100) or "unknown").lower(),
        severity=normalize_severity(event.get("severity")),
        src_ip=normalize_ip(pick("src_ip", "ip_address")),
        dst_ip=normalize_ip(pick("dst_ip")),
        user=safe_text(pick("user"), 100),
        hostname=safe_text(pick("hostname"), 255),
        domain=safe_text(pick("domain"), 255),
        url=normalize_url(pick("url", "target")),
        method=normalize_method(pick("method")),
        status_code=normalize_status(pick("status_code")),
        user_agent=safe_text(pick("user_agent"), 500),
        title=safe_text(event.get("title"), 255),
        description=safe_text(event.get("description"), 4096),
        raw_event=None,
        metadata=metadata,
    )
