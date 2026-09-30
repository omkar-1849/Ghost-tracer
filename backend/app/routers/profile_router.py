from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.schemas.profile_schema import ChangePasswordRequest, ProfileResponse, ProfileUpdateRequest
from app.services.profile_service import change_password, get_profile, update_profile
from app.utils.security import get_current_user, transaction
from app.utils.rate_limit import check_rate_limit
from app.services.audit_log_service import create_audit_log

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=ProfileResponse)
def profile(current_user: User = Depends(get_current_user)):
    return get_profile(current_user)


@router.put("", response_model=ProfileResponse)
def update(data: ProfileUpdateRequest, db: Session = Depends(get_db),
           current_user: User = Depends(get_current_user)):
    with transaction(db):
        user = update_profile(db, current_user, data)
        create_audit_log(db=db, organization_id=None, user_id=current_user.id,
                         action="UPDATE_PROFILE", resource_type="USER",
                         resource_id=str(current_user.id),
                         description="Profile details updated.")
    return user


@router.post("/change-password")
def change_user_password(data: ChangePasswordRequest, request: Request, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    check_rate_limit(request, current_user.email)
    with transaction(db):
        change_password(db, current_user, data)
        create_audit_log(db=db, organization_id=None, user_id=current_user.id,
                         action="PASSWORD_CHANGE", resource_type="USER",
                         resource_id=str(current_user.id),
                         description="Password changed; all sessions were revoked.",
                         ip_address=request.client.host if request.client else None,
                         user_agent=request.headers.get("user-agent", "")[:1000])
    return {"message": "Password changed successfully. Please log in again."}
