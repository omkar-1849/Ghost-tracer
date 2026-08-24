import hashlib
import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.event import Event


DEDUP_WINDOW_SECONDS = 60


def generate_event_fingerprint(
    event: dict[str, Any],
) -> str:
    fingerprint_data = {
        "source": event.get("source"),
        "event_type": event.get("event_type"),
        "src_ip": event.get("src_ip") or event.get("ip_address"),
        "dst_ip": event.get("dst_ip"),
        "user": event.get("user"),
        "url": event.get("url"),
        "title": event.get("title"),
    }

    payload = json.dumps(
        fingerprint_data,
        sort_keys=True,
        default=str,
    )

    return hashlib.sha256(payload.encode()).hexdigest()


def is_duplicate_event(
    db: Session,
    website_id: int,
    fingerprint: str,
    timestamp: datetime,
) -> bool:
    window_start = timestamp - timedelta(
        seconds=DEDUP_WINDOW_SECONDS
    )

    events = (
        db.query(Event)
        .filter(
            Event.website_id == website_id,
            Event.created_at >= window_start,
            Event.created_at <= timestamp,
        )
        .all()
    )

    for event in events:
        existing_fingerprint = generate_event_fingerprint(
            {
                "source": event.source,
                "event_type": event.event_type,
                "ip_address": event.ip_address,
                "title": event.title,
                "event_metadata": event.event_metadata,
            }
        )

        if existing_fingerprint == fingerprint:
            return True

    return False