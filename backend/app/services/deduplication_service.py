import hashlib
import json
from datetime import datetime, timedelta, timezone
from app.models.event import Event

DEDUP_WINDOW_SECONDS = 60


def generate_event_fingerprint(event):
    data = {key: event.get(key) for key in (
        "source", "event_type", "src_ip", "dst_ip", "url", "method", "status_code",
        "user_agent", "title", "description", "user",
    )}
    data["src_ip"] = event.get("src_ip") or event.get("ip_address")
    data["metadata"] = event.get("event_metadata", event.get("metadata", {}))
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=True, allow_nan=False).encode()).hexdigest()


def fingerprint_from_canonical(canonical):
    return generate_event_fingerprint(canonical.model_dump())


def find_duplicate_event(db, website_id, fingerprint, now=None, integration_id=None):
    org = db.info.get("organization_id")
    if org is None:
        raise ValueError("Tenant context required")
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is not None:
        now = now.astimezone(timezone.utc).replace(tzinfo=None)
    query = db.query(Event).filter(
        Event.organization_id == org, Event.website_id == website_id,
        Event.fingerprint == fingerprint,
        Event.created_at >= now - timedelta(seconds=DEDUP_WINDOW_SECONDS),
        Event.created_at <= now,
    )
    if integration_id is not None:
        query = query.filter(Event.integration_id == integration_id)
    return query.order_by(Event.created_at.desc(), Event.id.desc()).first()


def is_duplicate_event(db, website_id, fingerprint, timestamp=None):
    # Compatibility name returns the actual match; never anchor at an old row.
    return find_duplicate_event(db, website_id, fingerprint)
