from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.database.database import get_db
from app.models.user import User
from app.schemas.session_schema import SessionResponse
from app.services.session_service import (
    get_user_sessions,
    revoke_all_sessions,
    revoke_session,
)
from app.utils.security import get_current_user


router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"],
)


@router.get(
    "",
    response_model=list[SessionResponse],
)
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    return get_user_sessions(
        db,
        current_user.id,
    )


@router.delete(
    "/{session_id}",
)
def logout_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    revoke_session(
        db,
        session_id,
        current_user.id,
    )

    return {
        "message": "Session revoked successfully."
    }


@router.post(
    "/logout-all",
)
def logout_all(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    revoke_all_sessions(
        db,
        current_user.id,
    )

    return {
        "message": "All sessions revoked successfully."
    }