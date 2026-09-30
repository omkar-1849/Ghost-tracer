from dataclasses import dataclass
from typing import Any

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.utils.security import get_current_user


@dataclass(frozen=True)
class TenantContext:
    user: User
    organization_id: int
    role: str


def get_tenant_context(
    current_user: User = Depends(get_current_user),
    organization_header: str | None = Header(None, alias="X-Organization-ID"),
    db: Session = Depends(get_db),
) -> TenantContext:
    query = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id)
    if organization_header is not None:
        try:
            organization_id = int(organization_header)
            if organization_id <= 0:
                raise ValueError
        except ValueError:
            raise HTTPException(400, "Invalid organization selection.") from None
        membership = query.filter(OrganizationMember.organization_id == organization_id).first()
    else:
        memberships = query.limit(2).all()
        if len(memberships) > 1:
            raise HTTPException(400, "Select an organization using X-Organization-ID.")
        membership = memberships[0] if memberships else None
    if membership is None:
        raise HTTPException(403, "Organization membership is required.")
    if membership.role not in {"owner", "admin", "analyst", "viewer"}:
        raise HTTPException(403, "Invalid organization role.")
    previous = db.info.get("organization_id")
    if previous is not None and previous != membership.organization_id:
        raise HTTPException(403, "Cannot change tenant during a request.")
    db.info["organization_id"] = membership.organization_id
    db.info["actor_id"] = current_user.id
    return TenantContext(current_user, membership.organization_id, membership.role)


def require_roles(*roles):
    def check(context: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if context.role not in roles:
            raise HTTPException(403, "This organization role cannot perform that operation.")
        return context
    return check


def scoped_get(db: Session, model: Any, resource_id: int, context: TenantContext):
    resource = db.query(model).filter(
        model.id == resource_id, model.organization_id == context.organization_id
    ).first()
    if resource is None:
        raise HTTPException(404, "Resource not found.")
    return resource
