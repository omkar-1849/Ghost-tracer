from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.models.organization_member import OrganizationMember
from app.schemas.auth_schema import (
    ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest, RegisterRequest,
    ResetPasswordRequest, ResetPasswordResponse, TokenResponse, UserResponse,
)
from app.services.audit_log_service import create_audit_log
from app.services.auth_service import (
    authenticate_user, create_password_reset_token, create_user_token, register_user, reset_password,
)
from app.services.session_service import create_session
from app.utils.rate_limit import check_rate_limit
from app.utils.recovery_delivery import RecoveryDelivery, get_recovery_delivery
from app.utils.security import get_current_user, transaction

router = APIRouter(prefix="/auth", tags=["Authentication"])
RECOVERY_MESSAGE = {"message": "If an account exists, recovery instructions will be sent to its email address."}


def _audit(db: Session, request: Request, user_id: int, action: str):
    create_audit_log(db=db, organization_id=None, user_id=user_id,
                     action=action, resource_type="USER", resource_id=str(user_id),
                     ip_address=request.client.host if request.client else None,
                     user_agent=request.headers.get("user-agent", "")[:1000])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, data.email)
    with transaction(db):
        user = register_user(db, data)
        _audit(db, request, user.id, "REGISTER_USER")
    return user


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, data.email)
    with transaction(db):
        user = authenticate_user(db, data)
        session = create_session(db, user.id, request.client.host if request.client else None,
                                 request.headers.get("user-agent", "")[:1000])
        token = create_user_token(user, session.session_id)
        _audit(db, request, user.id, "LOGIN")
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(data: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db),
                    deliver: RecoveryDelivery = Depends(get_recovery_delivery)):
    # Throttled, missing, disabled, and delivery-failed cases have the same reply.
    if not check_rate_limit(request, data.email):
        return RECOVERY_MESSAGE.copy()
    try:
        with transaction(db):
            token = create_password_reset_token(db, data.email)
            if token is not None:
                # Do not commit a usable token when delivery fails. SMTP is bounded
                # by a timeout; no public spool or token-bearing log is created.
                deliver(data.email.lower().strip(), token)
    except Exception:
        # Neither SQL parameters nor mail server diagnostics belong in the API.
        return RECOVERY_MESSAGE.copy()
    return RECOVERY_MESSAGE.copy()


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password_endpoint(data: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request)
    with transaction(db):
        user = reset_password(db, data.token, data.new_password)
        _audit(db, request, user.id, "PASSWORD_RESET")
    return {"message": "Password has been reset successfully."}
