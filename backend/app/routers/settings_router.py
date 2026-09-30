from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.schemas.settings_schema import SettingsResponse, SettingsUpdate
from app.services import settings_service
from app.utils.authorization import TenantContext, get_tenant_context, require_roles

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return settings_service.redact_settings(settings_service.get_settings(db))


@router.put("", response_model=SettingsResponse)
def update_settings(updates: SettingsUpdate, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin"))):
    return settings_service.redact_settings(settings_service.update_settings(db, updates, ctx.user.id, ctx.organization_id))


@router.post("/reset", response_model=SettingsResponse)
def reset_settings(db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin"))):
    return settings_service.redact_settings(settings_service.reset_settings(db, ctx.user.id, ctx.organization_id))


@router.get("/export")
def export_settings(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return settings_service.export_settings(db)


@router.post("/import", response_model=SettingsResponse)
def import_settings(config: SettingsUpdate, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin"))):
    return settings_service.redact_settings(settings_service.update_settings(db, config, ctx.user.id, ctx.organization_id))
