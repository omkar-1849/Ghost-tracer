from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.utils.authorization import TenantContext, get_tenant_context, require_roles, scoped_get

from app.schemas.alert_schema import AlertResponse
from app.services.alert_service import get_all_alerts, get_recent_alerts

router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)


@router.get("", response_model=list[AlertResponse])
@router.get("/", response_model=list[AlertResponse], include_in_schema=False)
def get_alerts(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_all_alerts(db, ctx.organization_id)


@router.get("/recent", response_model=list[AlertResponse])
def recent_alerts(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_recent_alerts(db, ctx.organization_id)