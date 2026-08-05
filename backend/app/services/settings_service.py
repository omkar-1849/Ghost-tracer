from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.settings import Settings
from app.schemas.settings_schema import SettingsUpdate


def get_settings(db: Session) -> Settings:
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_settings(db: Session, updates: SettingsUpdate) -> Settings:
    settings = get_settings(db)
    
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
        
    db.commit()
    db.refresh(settings)
    return settings


def reset_settings(db: Session) -> Settings:
    settings = get_settings(db)
    db.delete(settings)
    db.commit()
    return get_settings(db)


def export_settings(db: Session) -> dict:
    settings = get_settings(db)
    
    exclude_fields = {"id", "created_at", "updated_at", "_sa_instance_state"}
    export_dict = {}
    for col in settings.__table__.columns:
        if col.name not in exclude_fields:
            export_dict[col.name] = getattr(settings, col.name)
            
    return export_dict


def import_settings(db: Session, config_data: dict) -> Settings:
    try:
        validated_data = SettingsUpdate(**config_data)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid configuration format: {str(e)}"
        )
        
    return update_settings(db, validated_data)
