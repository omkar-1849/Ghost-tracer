from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.profile_schema import (
    ChangePasswordRequest,
    ProfileUpdateRequest,
)
from app.services.session_service import revoke_all_sessions
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

    db.commit()
    db.refresh(user)

    return user


def change_password(
    db: Session,
    user: User,
    data: ChangePasswordRequest,
) -> None:

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

    db.commit()

    # Password change invalidates all existing sessions.
    revoke_all_sessions(
        db,
        user.id,
    )