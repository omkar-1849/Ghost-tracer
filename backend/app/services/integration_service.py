import hashlib
import secrets
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.integration import Integration
from app.models.website import Website
from app.models.organization_member import OrganizationMember
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id


def _hash(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def create_integration(
    db: Session,
    website_id: int,
    user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    website = (
        db.query(Website)
        .filter(Website.id == website_id)
        .first()
    )

    if website is None:
        return None, None, None

    existing = (
        db.query(Integration)
        .filter(Integration.website_id == website_id)
        .first()
    )

    organization_id = resolve_audit_organization_id(db, user_id)

    if existing is None:
        api_key = f"sk_{secrets.token_urlsafe(24)}"
        api_secret = secrets.token_urlsafe(48)

        integration = Integration(
            organization_id=organization_id or website.organization_id,
            website_id=website_id,
            api_key_hash=_hash(api_key),
            api_secret_hash=_hash(api_secret),
            status="Connected",
        )

        db.add(integration)
        db.flush()
        db.refresh(integration)

        if user_id is not None and organization_id is not None:
            create_audit_log(
                db=db,
                organization_id=organization_id,
                user_id=user_id,
                action="CREATE_API_TOKEN",
                resource_type="INTEGRATION",
                resource_id=str(integration.id),
                description="API integration created.",
                ip_address=ip_address,
                user_agent=user_agent,
            )

        return integration, api_key, api_secret

    if existing.status == "Revoked":
        api_key = f"sk_{secrets.token_urlsafe(24)}"
        api_secret = secrets.token_urlsafe(48)

        existing.organization_id = organization_id or website.organization_id or existing.organization_id
        existing.api_key_hash = _hash(api_key)
        existing.api_secret_hash = _hash(api_secret)
        existing.status = "Connected"
        existing.updated_at = datetime.utcnow()

        db.flush()
        db.refresh(existing)

        if user_id is not None and organization_id is not None:
            create_audit_log(
                db=db,
                organization_id=organization_id,
                user_id=user_id,
                action="RECONNECT_API_TOKEN",
                resource_type="INTEGRATION",
                resource_id=str(existing.id),
                description="API integration reconnected.",
                ip_address=ip_address,
                user_agent=user_agent,
            )

        return existing, api_key, api_secret

    return existing, None, None


def get_integration(
    db: Session,
    website_id: int,
):
    return (
        db.query(Integration)
        .filter(Integration.website_id == website_id)
        .first()
    )


def regenerate_keys(
    db: Session,
    website_id: int,
    user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    integration = get_integration(
        db,
        website_id,
    )

    if integration is None:
        return None

    organization_id = resolve_audit_organization_id(db, user_id)

    api_key = f"sk_{secrets.token_urlsafe(24)}"
    api_secret = secrets.token_urlsafe(48)

    integration.api_key_hash = _hash(api_key)
    integration.api_secret_hash = _hash(api_secret)
    integration.updated_at = datetime.utcnow()

    db.flush()
    db.refresh(integration)

    if user_id is not None and organization_id is not None:
        create_audit_log(
            db=db,
            organization_id=organization_id,
            user_id=user_id,
            action="REGENERATE_API_TOKEN",
            resource_type="INTEGRATION",
            resource_id=str(integration.id),
            description="API integration keys regenerated.",
            ip_address=ip_address,
            user_agent=user_agent,
        )

    return integration, api_key, api_secret


def revoke_integration(
    db: Session,
    website_id: int,
    user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    integration = (
        db.query(Integration)
        .filter(
            Integration.website_id == website_id
        )
        .first()
    )

    if integration is None:
        return None

    # Already revoked
    if integration.status == "Revoked":
        return integration

    organization_id = resolve_audit_organization_id(db, user_id)

    integration.status = "Revoked"
    integration.updated_at = datetime.utcnow()

    db.flush()
    db.refresh(integration)

    if user_id is not None and organization_id is not None:
        create_audit_log(
            db=db,
            organization_id=organization_id,
            user_id=user_id,
            action="REVOKE_API_TOKEN",
            resource_type="INTEGRATION",
            resource_id=str(integration.id),
            description="API integration revoked.",
            ip_address=ip_address,
            user_agent=user_agent,
        )

    return integration


def validate_api_key(
    db: Session,
    api_key: str,
):
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
        db.flush()
        db.refresh(integration)

        organization_id = integration.organization_id
        if organization_id is None:
            return None

        create_audit_log(
            db=db,
            organization_id=organization_id,
            user_id=None,
            action="API_KEY_USED",
            resource_type="INTEGRATION",
            resource_id=str(integration.id),
            description="API key used for integration authentication.",
        )

    return integration