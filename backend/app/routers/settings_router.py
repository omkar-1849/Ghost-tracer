from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.user import User
from app.models.organization_member import OrganizationMember
from app.schemas.settings_schema import SettingsResponse, SettingsUpdate
from app.services import settings_service
from app.utils.security import get_current_user

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


def _get_organization_id(db: Session, user_id: int) -> int:
    org_id = (
        db.query(OrganizationMember.organization_id)
        .filter(OrganizationMember.user_id == user_id)
        .scalar()
    )
    return org_id if org_id is not None else 1


@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    return settings_service.get_settings(db)


@router.put("", response_model=SettingsResponse)
def update_settings(
    updates: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.update_settings(
        db,
        updates,
        user_id=current_user.id,
        organization_id=_get_organization_id(db, current_user.id),
    )


@router.post("/reset", response_model=SettingsResponse)
def reset_settings(db: Session = Depends(get_db)):
    return settings_service.reset_settings(db)


@router.get("/export")
def export_settings(db: Session = Depends(get_db)):
    return settings_service.export_settings(db)


@router.post("/import", response_model=SettingsResponse)
def import_settings(config: dict = Body(...), db: Session = Depends(get_db)):
    return settings_service.import_settings(db, config)
