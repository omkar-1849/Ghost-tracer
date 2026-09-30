import os
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.settings import Settings
from app.schemas.settings_schema import SettingsUpdate, SettingsResponse
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id


def get_settings(db: Session) -> Settings:
    organization_id = resolve_audit_organization_id(db)
    settings = db.query(Settings).filter(Settings.organization_id == organization_id).first()
    if settings is None:
        settings = Settings(organization_id=organization_id, api_key="env:SENTINEL_AI_API_KEY")
        db.add(settings)
        db.flush()
    return settings


def redact_settings(settings: Settings) -> dict:
    # Never serialize the ORM secret column, including legacy plaintext values.
    values = {name: getattr(settings, name) for name in SettingsResponse.model_fields
              if name not in {"api_key", "api_key_configured"}}
    values["api_key"] = None
    values["api_key_configured"] = bool(os.getenv("SENTINEL_AI_API_KEY"))
    return values


def update_settings(db: Session, updates: SettingsUpdate, user_id: int, organization_id: int) -> Settings:
    settings = get_settings(db)
    if organization_id != settings.organization_id:
        raise HTTPException(status_code=404, detail="Settings not found.")
    update_data = updates.model_dump(exclude_unset=True)
    # An unchanged executable field is accepted for older full-form clients.
    if "sqlmap_path" in update_data and update_data["sqlmap_path"] != settings.sqlmap_path:
        raise HTTPException(status_code=400, detail="Scanner executable paths are deployment-managed and cannot be changed.")
    if update_data.get("proxy") not in (None, "", settings.proxy):
        raise HTTPException(status_code=400, detail="Scanner proxy configuration is deployment-managed.")
    for key, value in update_data.items():
        if key not in {"api_key", "api_key_configured", "sqlmap_path", "proxy"} and value is not None:
            setattr(settings, key, value)
    settings.api_key = "env:SENTINEL_AI_API_KEY"
    db.flush()
    create_audit_log(db, organization_id, "CHANGE_SETTINGS", user_id=user_id,
                     resource_type="SETTINGS", resource_id=str(settings.id), description="Platform settings updated.")
    return settings


def reset_settings(db: Session, user_id: int, organization_id: int) -> Settings:
    settings = get_settings(db)
    # Reset only writable public options; keep deployment-managed fields intact.
    defaults = {name: field.default for name, field in SettingsResponse.model_fields.items()
                if name in SettingsUpdate.model_fields and name not in {"sqlmap_path", "proxy", "api_key", "api_key_configured"}}
    return update_settings(db, SettingsUpdate(**defaults), user_id, organization_id)


def export_settings(db: Session) -> dict:
    values = redact_settings(get_settings(db))
    return {name: value for name, value in values.items() if name in SettingsUpdate.model_fields}


def import_settings(db: Session, config_data: dict, user_id: int, organization_id: int) -> Settings:
    return update_settings(db, SettingsUpdate(**config_data), user_id, organization_id)
