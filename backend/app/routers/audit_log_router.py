from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.schemas.audit_log_schema import AuditLogResponse
from app.services.audit_log_service import get_organization_audit_logs
from app.utils.authorization import TenantContext, get_tenant_context

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_organization_audit_logs(db, ctx.organization_id, limit)
