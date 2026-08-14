from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session as DBSession

from app.database.database import get_db
from app.models.user import User
from app.schemas.session_schema import SessionResponse
from app.services.session_service import (
    get_user_sessions,
    revoke_all_sessions,
    revoke_session,
)
from app.services.audit_log_service import create_audit_log
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
    request: Request,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    revoke_session(
        db,
        session_id,
        current_user.id,
    )

    # Get user's organization_id
    from app.models.organization_member import OrganizationMember
    membership = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == current_user.id)
        .first()
    )
    organization_id = membership.organization_id if membership else 1

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=current_user.id,
        action="LOGOUT",
        resource_type="SESSION",
        resource_id=session_id,
        description="User logged out (single session).",
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
    )

    return {
        "message": "Session revoked successfully."
    }


@router.post(
    "/logout-all",
)
def logout_all(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    revoke_all_sessions(
        db,
        current_user.id,
    )

    # Get user's organization_id
    from app.models.organization_member import OrganizationMember
    membership = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == current_user.id)
        .first()
    )
    organization_id = membership.organization_id if membership else 1

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=current_user.id,
        action="LOGOUT",
        resource_type="SESSION",
        resource_id="all",
        description="User logged out (all sessions).",
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
    )

    return {
        "message": "All sessions revoked successfully."
    }