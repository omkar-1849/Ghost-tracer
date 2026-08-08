import hashlib
import secrets
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.integration import Integration
from app.models.website import Website


def _hash(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def create_integration(db: Session, website_id: int):
    website = db.query(Website).filter(Website.id == website_id).first()

    if website is None:
        return None, None, None

    existing = (
        db.query(Integration)
        .filter(Integration.website_id == website_id)
        .first()
    )

    # -------------------------------
    # FIRST TIME CONNECTION
    # -------------------------------
    if existing is None:
        api_key = f"sk_{secrets.token_urlsafe(24)}"
        api_secret = secrets.token_urlsafe(48)

        integration = Integration(
            website_id=website_id,
            api_key_hash=_hash(api_key),
            api_secret_hash=_hash(api_secret),
            status="Connected",
        )

        db.add(integration)
        db.commit()
        db.refresh(integration)

        return integration, api_key, api_secret

    # -------------------------------
    # RECONNECT AFTER REVOCATION
    # -------------------------------
    if existing.status == "Revoked":
        api_key = f"sk_{secrets.token_urlsafe(24)}"
        api_secret = secrets.token_urlsafe(48)

        existing.api_key_hash = _hash(api_key)
        existing.api_secret_hash = _hash(api_secret)
        existing.status = "Connected"
        existing.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(existing)

        return existing, api_key, api_secret

    # Already connected
    return existing, None, None


def get_integration(db: Session, website_id: int):
    return (
        db.query(Integration)
        .filter(Integration.website_id == website_id)
        .first()
    )


def regenerate_keys(db: Session, website_id: int):
    integration = get_integration(db, website_id)

    if integration is None:
        return None

    api_key = f"sk_{secrets.token_urlsafe(24)}"
    api_secret = secrets.token_urlsafe(48)

    integration.api_key_hash = _hash(api_key)
    integration.api_secret_hash = _hash(api_secret)
    integration.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(integration)

    return integration, api_key, api_secret


def revoke_integration(db: Session, website_id: int):
    integration = get_integration(db, website_id)

    if integration is None:
        return None

    integration.status = "Revoked"
    integration.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(integration)

    return integration


def validate_api_key(db: Session, api_key: str):
    key_hash = _hash(api_key)

    integration = (
        db.query(Integration)
        .filter(
            Integration.api_key_hash == key_hash,
            Integration.status == "Connected",
        )
        .first()
    )

    if integration:
        integration.last_used = datetime.utcnow()
        db.commit()
        db.refresh(integration)

    return integration