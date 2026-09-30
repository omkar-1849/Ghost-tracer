"""Auth mutations flush only; owning route commits together with audit."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.models.session import Session as UserSession
from app.schemas.auth_schema import LoginRequest, RegisterRequest
from app.utils.reset_token import generate_reset_token, hash_reset_token
from app.utils.security import create_access_token, hash_password, verify_password


def register_user(db: Session, data: RegisterRequest) -> User:
    email = data.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Unable to register with these details.")
    user = User(email=email, password_hash=hash_password(data.password), full_name=data.full_name)
    db.add(user)
    db.flush()
    return user


def authenticate_user(db: Session, data: LoginRequest) -> User:
    # Serialize login/session creation with password rotation. Refresh a previously
    # loaded identity so concurrent changes cannot authenticate an old password.
    user = (db.query(User).filter(User.email == data.email.lower().strip())
            .populate_existing().with_for_update().first())
    if not user or not user.is_active or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.", headers={"WWW-Authenticate": "Bearer"})
    return user


def create_user_token(user: User, session_id: str) -> str:
    return create_access_token(str(user.id), session_id)


def invalidate_user_credentials(db: Session, user_id: int) -> None:
    """Caller holds the user row lock; invalidate sessions and all reset tokens."""
    db.query(UserSession).filter(UserSession.user_id == user_id).update(
        {UserSession.revoked: True}, synchronize_session=False)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).update(
        {PasswordResetToken.used: True}, synchronize_session=False)
    db.flush()


def create_password_reset_token(db: Session, email: str) -> str | None:
    user = (db.query(User).filter(User.email == email.lower().strip())
            .populate_existing().with_for_update().first())
    if not user or not user.is_active:
        return None
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).update(
        {PasswordResetToken.used: True}, synchronize_session=False)
    raw_token = generate_reset_token()
    db.add(PasswordResetToken(user_id=user.id, token_hash=hash_reset_token(raw_token),
                             expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)))
    db.flush()
    return raw_token


def reset_password(db: Session, token: str, new_password: str) -> User:
    token_hash = hash_reset_token(token)
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    if not reset_token:
        raise HTTPException(400, "Invalid or expired reset token.")
    # Always lock user before token to keep issuance/change/reset lock ordering.
    user = (db.query(User).filter(User.id == reset_token.user_id)
            .populate_existing().with_for_update().first())
    if not user or not user.is_active:
        raise HTTPException(400, "Invalid or expired reset token.")
    claimed = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used.is_(False),
        PasswordResetToken.expires_at > datetime.now(timezone.utc),
    ).update({PasswordResetToken.used: True}, synchronize_session=False)
    if claimed != 1:
        raise HTTPException(400, "Invalid or expired reset token.")
    user.password_hash = hash_password(new_password)
    invalidate_user_credentials(db, user.id)
    db.flush()
    return user
