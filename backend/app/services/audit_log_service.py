from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.organization_member import OrganizationMember


def resolve_audit_organization_id(
    db: Session,
    user_id: Optional[int] = None,
) -> int:
    """Best-effort resolution of an organization id for audit logging.

    Prefers the organization of the given user; falls back to the first
    known organization. Always returns an int (default 1) and never raises,
    so callers can use it unconditionally before ``create_audit_log``.
    """
    try:
        stmt = db.query(OrganizationMember.organization_id)
        if user_id is not None:
            stmt = stmt.filter(OrganizationMember.user_id == user_id)
        row = stmt.limit(1).first()
        if row is not None:
            return row[0]
    except Exception:
        pass
    return 1


def create_audit_log(
    db: Session,
    organization_id: int,
    action: str,
    user_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    # Best-effort: an audit-log failure must never break the original
    # operation that triggered it. Roll back only the failed audit add so
    # the caller's session stays usable.
    try:
        audit_log = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)

        return audit_log
    except Exception:
        db.rollback()
        return None


def get_organization_audit_logs(
    db: Session,
    organization_id: int,
    limit: int = 100,
):
    return (
        db.query(AuditLog)
        .filter(AuditLog.organization_id == organization_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )