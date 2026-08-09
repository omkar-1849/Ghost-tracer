from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.auth_schema import LoginRequest, RegisterRequest
from app.utils.security import create_access_token, hash_password, verify_password

from datetime import datetime, timedelta, timezone

from app.models.password_reset_token import PasswordResetToken
from app.utils.reset_token import generate_reset_token, hash_reset_token


def register_user(
    db: Session,
    data: RegisterRequest,
) -> User:

    existing_user = (
        db.query(User)
        .filter(User.email == data.email.lower())
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def authenticate_user(
    db: Session,
    data: LoginRequest,
) -> User:

    email = data.email.lower().strip()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user or not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled.",
        )

    return user


def create_user_token(
    user: User,
    session_id: str,
) -> str:
    return create_access_token(
        str(user.id),
        session_id,
    )


def create_password_reset_token(
    db: Session,
    email: str,
) -> str | None:

    user = (
        db.query(User)
        .filter(User.email == email.lower().strip())
        .first()
    )

    if not user:
        return None

    # Invalidate previous unused tokens
    (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
        )
        .update({"used": True})
    )

    raw_token = generate_reset_token()

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )

    db.add(reset_token)
    db.commit()

    return raw_token


def reset_password(
    db: Session,
    token: str,
    new_password: str,
) -> None:

    token_hash = hash_reset_token(token)

    reset_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,
        )
        .first()
    )

    if not reset_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    now = datetime.now(timezone.utc)

    expires_at = reset_token.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        reset_token.used = True
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    user = (
        db.query(User)
        .filter(User.id == reset_token.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid reset token.",
        )

    user.password_hash = hash_password(new_password)

    reset_token.used = True

    db.commit()