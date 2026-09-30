from datetime import datetime, timezone
from ipaddress import ip_address
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from app.schemas.event_schema import CanonicalSecurityEvent, bounded_metadata

NORMALIZATION_VERSION = 1
SEVERITY_MAP = {"info": "Info", "informational": "Info", "low": "Low", "medium": "Medium", "moderate": "Medium", "high": "High", "critical": "Critical"}
HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"}


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
