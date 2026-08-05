from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.schemas.settings_schema import SettingsResponse, SettingsUpdate
from app.services import settings_service

router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    return settings_service.get_settings(db)


@router.put("", response_model=SettingsResponse)
def update_settings(updates: SettingsUpdate, db: Session = Depends(get_db)):
    return settings_service.update_settings(db, updates)


@router.post("/reset", response_model=SettingsResponse)
def reset_settings(db: Session = Depends(get_db)):
    return settings_service.reset_settings(db)


@router.get("/export")
def export_settings(db: Session = Depends(get_db)):
    return settings_service.export_settings(db)


@router.post("/import", response_model=SettingsResponse)
def import_settings(config: dict = Body(...), db: Session = Depends(get_db)):
    return settings_service.import_settings(db, config)
