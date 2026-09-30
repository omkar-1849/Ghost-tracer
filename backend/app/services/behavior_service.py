"""Correlation uses tenant/website database history, never reported attempt counts."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from app.models.log import Log
from app.models.event import Event

AUTH_FAILURE_TYPES = {"login_failed", "authentication_failure", "brute_force", "brute_force_test", "brute_force_attack", "credential_attack"}
BRUTE_FORCE_WINDOW = timedelta(minutes=1)


def is_auth_failure(event_type=None, status_code=None, message=None):
    return (event_type in AUTH_FAILURE_TYPES or status_code in {401, 403}
            or any(token in (message or "").lower() for token in AUTH_FAILURE_TYPES))


def _queries(db, website_id, now):
    org = db.info.get("organization_id")
    if org is None:
        raise ValueError("Tenant context required")
    now = (now or datetime.now(timezone.utc)).replace(tzinfo=None)
    start = now - BRUTE_FORCE_WINDOW
    logs = db.query(Log).filter(
        Log.organization_id == org, Log.website_id == website_id,
        Log.timestamp >= start, Log.timestamp <= now,
        or_(Log.status_code.in_([401, 403]), *[func.lower(Log.message).contains(t) for t in AUTH_FAILURE_TYPES]),
    )
    events = db.query(Event).filter(
        Event.organization_id == org, Event.website_id == website_id,
        Event.created_at >= start, Event.created_at <= now,
        # Event type is canonical; HTTP auth failures are recorded in analysis.
        or_(Event.event_type.in_(AUTH_FAILURE_TYPES), Event.detection_result["auth_failure"].as_boolean() == True),
    )
    return logs, events


def get_recent_failed_logins(db: Session, ip_address: str, website_id=None, now=None):
    logs, _ = _queries(db, website_id, now)
    return logs.filter(Log.ip_address == ip_address).limit(1000).all() if ip_address else []


def count_recent_auth_failures(db, ip_address, website_id=None, now=None):
    if not ip_address:
        return 0
    logs, events = _queries(db, website_id, now)
    return (logs.filter(Log.ip_address == ip_address).count()
            + events.filter(Event.ip_address == ip_address).count())


def detect_brute_force(db, ip_address, website_id=None, now=None):
    count = count_recent_auth_failures(db, ip_address, website_id, now)
    return {"detected": count >= 5, "score": 20 if count >= 5 else 0,
            "reason": "Repeated reported authentication failures" if count >= 5 else None}


def get_attempt_signal(db, website_id, ip_address, now=None, current_failure=False):
    count = count_recent_auth_failures(db, ip_address, website_id, now) if current_failure else 0
    return {"attempts": count + int(bool(current_failure)), "source": "tenant_database_auth_history"}
