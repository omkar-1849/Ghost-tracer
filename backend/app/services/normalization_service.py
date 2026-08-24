from datetime import datetime, timezone
from typing import Any

from app.schemas.event_schema import CanonicalSecurityEvent


SEVERITY_MAP = {
    "info": "Info",
    "informational": "Info",
    "low": "Low",
    "medium": "Medium",
    "moderate": "Medium",
    "high": "High",
    "critical": "Critical",
}


def normalize_severity(severity: str | None) -> str:
    if not severity:
        return "Info"

    return SEVERITY_MAP.get(
        severity.strip().lower(),
        "Info",
    )


def normalize_timestamp(timestamp: Any) -> datetime:
    if isinstance(timestamp, datetime):
        value = timestamp
    else:
        value = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def normalize_event(event: dict[str, Any]) -> CanonicalSecurityEvent:
    metadata = event.get("event_metadata") or event.get("metadata") or {}

    return CanonicalSecurityEvent(
        event_id=str(event["event_id"]) if event.get("event_id") is not None else None,
        timestamp=normalize_timestamp(
            event.get("timestamp")
            or event.get("created_at")
            or datetime.now(timezone.utc)
        ),
        source=str(event.get("source", "unknown")).strip().lower(),
        source_type=str(
            event.get("source_type")
            or event.get("source", "unknown")
        ).strip().lower(),
        event_type=str(event.get("event_type", "unknown")).strip().lower(),
        severity=normalize_severity(event.get("severity")),
        src_ip=event.get("src_ip") or event.get("ip_address"),
        dst_ip=event.get("dst_ip"),
        src_port=event.get("src_port"),
        dst_port=event.get("dst_port"),
        protocol=event.get("protocol"),
        user=event.get("user"),
        hostname=event.get("hostname"),
        domain=event.get("domain"),
        url=event.get("url"),
        method=event.get("method"),
        status_code=event.get("status_code"),
        user_agent=event.get("user_agent"),
        title=event.get("title"),
        description=event.get("description"),
        raw_event=event,
        metadata=metadata,
    )