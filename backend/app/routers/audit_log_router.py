from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.schemas.audit_log_schema import AuditLogResponse
from app.services.audit_log_service import get_organization_audit_logs
from app.utils.security import get_current_user


router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"],
)


@router.get(
    "",
    response_model=list[AuditLogResponse],
)
def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == current_user.id
        )
        .first()
    )

    if membership is None:
        return []

    return get_organization_audit_logs(
        db,
        membership.organization_id,
        limit,
    )