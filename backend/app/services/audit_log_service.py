from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def resolve_audit_organization_id(db: Session, user_id: Optional[int] = None) -> int:
    """Use only the validated request tenant; never infer from a membership."""
    organization_id = db.info.get("organization_id")
    if organization_id is None:
        raise ValueError("An explicit validated organization is required for tenant audit events")
    return organization_id


def create_audit_log(
    db: Session, organization_id: Optional[int], action: str,
    user_id: Optional[int] = None, resource_type: Optional[str] = None,
    resource_id: Optional[str] = None, description: Optional[str] = None,
    ip_address: Optional[str] = None, user_agent: Optional[str] = None,
):
    """Participate in the caller's transaction. Failure must abort the operation.

    Identity events may explicitly supply organization_id=None. Tenant callers
    must provide their validated organization and the authenticated actor.
    """
    selected = db.info.get("organization_id")
    if selected is not None and organization_id != selected:
        raise ValueError("Audit tenant does not match the active tenant")
    audit_log = AuditLog(
        organization_id=organization_id, user_id=user_id, action=action,
        resource_type=resource_type, resource_id=resource_id, description=description,
        ip_address=ip_address, user_agent=user_agent,
    )
    db.add(audit_log)
    db.flush()
    return audit_log


def get_organization_audit_logs(db: Session, organization_id: int, limit: int = 100):
    return (db.query(AuditLog).filter(AuditLog.organization_id == organization_id)
            .order_by(AuditLog.created_at.desc()).limit(limit).all())
