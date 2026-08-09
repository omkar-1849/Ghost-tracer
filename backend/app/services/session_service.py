import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session as DBSession

from app.models.session import Session


SESSION_DURATION_MINUTES = 60 * 24 * 7


def create_session(
    db: DBSession,
    user_id: int,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> Session:

    now = datetime.now(timezone.utc)

    session = Session(
        user_id=user_id,
        session_id=secrets.token_urlsafe(32),
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=now,
        expires_at=now + timedelta(
            minutes=SESSION_DURATION_MINUTES
        ),
        last_used_at=now,
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session


def get_user_sessions(
    db: DBSession,
    user_id: int,
) -> list[Session]:

    return (
        db.query(Session)
        .filter(
            Session.user_id == user_id,
            Session.revoked == False,
        )
        .order_by(Session.created_at.desc())
        .all()
    )


def get_session(
    db: DBSession,
    session_id: str,
) -> Session | None:

    return (
        db.query(Session)
        .filter(Session.session_id == session_id)
        .first()
    )


def validate_session(
    db: DBSession,
    session_id: str,
    user_id: int,
) -> Session:

    session = (
        db.query(Session)
        .filter(
            Session.session_id == session_id,
            Session.user_id == user_id,
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Session not found.",
        )

    if session.revoked:
        raise HTTPException(
            status_code=401,
            detail="Session has been revoked.",
        )

    expires_at = session.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at < datetime.now(timezone.utc):
        session.revoked = True
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Session has expired.",
        )

    session.last_used_at = datetime.now(timezone.utc)
    db.commit()

    return session


def revoke_session(
    db: DBSession,
    session_id: str,
    user_id: int,
) -> None:

    session = (
        db.query(Session)
        .filter(
            Session.session_id == session_id,
            Session.user_id == user_id,
        )
        .first()
    )

    if session:
        session.revoked = True
        db.commit()


def revoke_all_sessions(
    db: DBSession,
    user_id: int,
) -> None:

    (
        db.query(Session)
        .filter(
            Session.user_id == user_id,
            Session.revoked == False,
        )
        .update(
            {
                Session.revoked: True,
            },
            synchronize_session=False,
        )
    )

    db.commit()