from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.schemas.profile_schema import (
    ChangePasswordRequest,
    ProfileResponse,
    ProfileUpdateRequest,
)
from app.services.profile_service import (
    change_password,
    get_profile,
    update_profile,
)
from app.utils.security import get_current_user


router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
)


@router.get(
    "",
    response_model=ProfileResponse,
)
def profile(
    current_user: User = Depends(get_current_user),
):
    return get_profile(current_user)


@router.put(
    "",
    response_model=ProfileResponse,
)
def update(
    data: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_profile(
        db,
        current_user,
        data,
    )


@router.post(
    "/change-password",
)
def change_user_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    change_password(
        db,
        current_user,
        data,
    )

    return {
        "message": "Password changed successfully. Please log in again."
    }