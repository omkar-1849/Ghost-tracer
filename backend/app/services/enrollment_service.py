import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enrollment_token import EnrollmentToken
from app.models.integration import Integration
from app.models.website import Website
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id


def derive_token_status(token: EnrollmentToken) -> str:
    if token.revoked_at is not None:
        return "revoked"
    now = datetime.utcnow()
    if token.expires_at <= now:
        return "expired"
    if token.used_count >= token.max_uses:
        return "exhausted"
    return "active"


def create_token(
    db: Session,
    website: Website,
    user_id: int,
    label: Optional[str] = None,
    expires_in_hours: int = 1,
    max_uses: int = 1,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    if website.archived_at is not None:
        raise HTTPException(status_code=404, detail="Website not found.")

    raw_token = f"snt_enr_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    token_prefix = raw_token[:14]
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

    token_row = EnrollmentToken(
        organization_id=website.organization_id,
        website_id=website.id,
        token_hash=token_hash,
        token_prefix=token_prefix,
        label=label,
        created_by_user_id=user_id,
        expires_at=expires_at,
        max_uses=max_uses,
        used_count=0,
    )
    db.add(token_row)
    db.flush()
    db.refresh(token_row)

    org_id = resolve_audit_organization_id(db, user_id) or website.organization_id
    create_audit_log(
        db=db,
        organization_id=org_id,
        user_id=user_id,
        action="ENROLLMENT_TOKEN_CREATED",
        resource_type="ENROLLMENT_TOKEN",
        resource_id=str(token_row.id),
        description=f"Enrollment token '{token_prefix}...' created.",
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return token_row, raw_token


def list_tokens(db: Session, website_id: int):
    tokens = (
        db.query(EnrollmentToken)
        .filter(EnrollmentToken.website_id == website_id)
        .order_by(EnrollmentToken.created_at.desc())
        .all()
    )
    result = []
    for t in tokens:
        result.append(
            {
                "id": t.id,
                "website_id": t.website_id,
                "label": t.label,
                "token_prefix": t.token_prefix,
                "expires_at": t.expires_at,
                "max_uses": t.max_uses,
                "used_count": t.used_count,
                "status": derive_token_status(t),
                "created_by_user_id": t.created_by_user_id,
                "created_at": t.created_at,
                "last_used_at": t.last_used_at,
                "revoked_at": t.revoked_at,
            }
        )
    return result


def revoke_token(
    db: Session,
    website_id: int,
    token_id: int,
    user_id: int,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    token = (
        db.query(EnrollmentToken)
        .filter(EnrollmentToken.id == token_id)
        .first()
    )
    if token is None or token.website_id != website_id:
        raise HTTPException(status_code=404, detail="Enrollment token not found.")

    if token.revoked_at is None:
        token.revoked_at = datetime.utcnow()
        db.flush()

        org_id = resolve_audit_organization_id(db, user_id) or token.organization_id
        create_audit_log(
            db=db,
            organization_id=org_id,
            user_id=user_id,
            action="ENROLLMENT_TOKEN_REVOKED",
            resource_type="ENROLLMENT_TOKEN",
            resource_id=str(token.id),
            description=f"Enrollment token '{token.token_prefix}...' revoked.",
            ip_address=ip_address,
            user_agent=user_agent,
        )

    return True


def create_tenant_token(
    db: Session,
    organization_id: int,
    user_id: int,
    label: Optional[str] = None,
    expires_in_hours: int = 24,
    max_uses: int = 1,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    raw_token = f"snt_enr_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    token_prefix = raw_token[:14]
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

    token_row = EnrollmentToken(
        organization_id=organization_id,
        website_id=None,
        token_hash=token_hash,
        token_prefix=token_prefix,
        label=label,
        created_by_user_id=user_id,
        expires_at=expires_at,
        max_uses=max_uses,
        used_count=0,
    )
    db.add(token_row)
    db.flush()
    db.refresh(token_row)

    org_id = resolve_audit_organization_id(db, user_id) or organization_id
    create_audit_log(
        db=db,
        organization_id=org_id,
        user_id=user_id,
        action="ENROLLMENT_TOKEN_CREATED",
        resource_type="ENROLLMENT_TOKEN",
        resource_id=str(token_row.id),
        description=f"Tenant enrollment token '{token_prefix}...' created.",
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return token_row, raw_token


def get_token_status(db: Session, organization_id: int, token_id: int):
    token = (
        db.query(EnrollmentToken)
        .filter(
            EnrollmentToken.id == token_id,
            EnrollmentToken.organization_id == organization_id,
        )
        .first()
    )
    if token is None:
        raise HTTPException(status_code=404, detail="Enrollment token not found.")

    status = derive_token_status(token)
    website_data = None
    collector_data = None

    if token.website_id is not None:
        website = (
            db.query(Website)
            .filter(
                Website.id == token.website_id,
                Website.organization_id == organization_id,
            )
            .first()
        )
        if website:
            website_data = {
                "id": website.id,
                "name": website.name,
                "domain": website.domain,
                "exposure": website.exposure,
                "status": website.status,
            }

        collector = (
            db.query(Integration)
            .filter(
                Integration.enrollment_token_id == token.id,
                Integration.organization_id == organization_id,
            )
            .order_by(Integration.created_at.desc())
            .first()
        )
        if collector:
            collector_data = {
                "id": collector.id,
                "name": collector.name,
                "kind": collector.kind,
                "hostname": collector.hostname,
                "version": collector.version,
                "status": collector.status,
                "last_heartbeat_at": collector.last_heartbeat_at,
            }

    return {
        "id": token.id,
        "token_prefix": token.token_prefix,
        "status": status,
        "expires_at": token.expires_at,
        "max_uses": token.max_uses,
        "used_count": token.used_count,
        "website_id": token.website_id,
        "website": website_data,
        "collector": collector_data,
    }
