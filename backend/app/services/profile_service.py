from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.profile_schema import (
    ChangePasswordRequest,
    ProfileUpdateRequest,
)
from app.services.auth_service import invalidate_user_credentials
from app.utils.security import hash_password, verify_password


def get_profile(user: User) -> User:
    return user


def update_profile(
    db: Session,
    user: User,
    data: ProfileUpdateRequest,
) -> User:

    update_data = data.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():
        setattr(user, key, value)

    db.flush()
    db.refresh(user)

    return user


def change_password(
    db: Session,
    user: User,
    data: ChangePasswordRequest,
) -> None:

    user = (db.query(User).filter(User.id == user.id)
            .populate_existing().with_for_update().first())
    if not user or not user.is_active:
        raise HTTPException(401, "Authentication required.")

    if not verify_password(
        data.current_password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect.",
        )

    if verify_password(
        data.new_password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password.",
        )

    user.password_hash = hash_password(
        data.new_password
    )

    # Password change invalidates all existing sessions.
    invalidate_user_credentials(
        db,
        user.id,
    )

    db.flush()
