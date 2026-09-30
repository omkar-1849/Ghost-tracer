from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session as DBSession

from app.database.database import get_db
from app.models.user import User
from app.models.organization_member import OrganizationMember
from app.schemas.session_schema import SessionResponse
from app.services.session_service import get_user_sessions, revoke_all_sessions, revoke_session
from app.services.audit_log_service import create_audit_log
from app.utils.security import bearer_scheme, decode_access_token, get_current_user, transaction

router = APIRouter(prefix="/sessions", tags=["Sessions"])


def _audit(db, request, user_id, description):
    create_audit_log(db=db, organization_id=None, user_id=user_id,
                     action="LOGOUT", resource_type="SESSION", description=description,
                     ip_address=request.client.host if request.client else None,
                     user_agent=request.headers.get("user-agent", "")[:1000])


@router.get("", response_model=list[SessionResponse])
def list_sessions(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    return get_user_sessions(db, current_user.id)


@router.post("/logout")
def logout_current_session(request: Request, current_user: User = Depends(get_current_user),
                           db: DBSession = Depends(get_db), credentials=Depends(bearer_scheme)):
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("sub") != str(current_user.id) or not isinstance(payload.get("sid"), str):
        raise HTTPException(401, "Invalid authentication token.")
    with transaction(db):
        revoke_session(db, payload["sid"], current_user.id)
        _audit(db, request, current_user.id, "Current session revoked.")
    return {"message": "Session revoked successfully."}


@router.delete("/{session_id}")
def logout_session(session_id: str, request: Request, current_user: User = Depends(get_current_user),
                   db: DBSession = Depends(get_db)):
    with transaction(db):
        revoke_session(db, session_id, current_user.id)
        _audit(db, request, current_user.id, "Selected session revoked.")
    return {"message": "Session revoked successfully."}


@router.post("/logout-all")
def logout_all(request: Request, current_user: User = Depends(get_current_user),
               db: DBSession = Depends(get_db)):
    with transaction(db):
        revoke_all_sessions(db, current_user.id)
        _audit(db, request, current_user.id, "All sessions revoked.")
    return {"message": "All sessions revoked successfully."}
