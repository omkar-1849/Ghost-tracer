from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.schemas.auth_schema import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
    UserResponse,
)
from app.services.audit_log_service import create_audit_log
from app.services.auth_service import (
    authenticate_user,
    create_password_reset_token,
    create_user_token,
    register_user,
    reset_password,
)
from app.services.session_service import create_session
from app.utils.security import get_current_user


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201,
)
def register(
    data: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user = register_user(db, data)

    # Get user's organization_id if they have one
    from app.models.organization_member import OrganizationMember
    membership = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id)
        .first()
    )
    organization_id = membership.organization_id if membership else 1

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=user.id,
        action="REGISTER_USER",
        resource_type="USER",
        resource_id=str(user.id),
        description="User registered successfully.",
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
    )

    return user


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user = authenticate_user(
        db,
        data,
    )

    session = create_session(
        db=db,
        user_id=user.id,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
    )

    create_audit_log(
        db=db,
        organization_id=1,
        user_id=user.id,
        action="LOGIN",
        resource_type="USER",
        resource_id=str(user.id),
        description="User logged in successfully.",
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
        "access_token": create_user_token(
            user,
            session.session_id,
        ),
        "token_type": "bearer",
        "user": user,
    }


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
)
def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    # Look up the user (do NOT leak whether the account exists)
    from app.models.user import User
    from app.models.organization_member import OrganizationMember
    user = (
        db.query(User)
        .filter(User.email == data.email.lower().strip())
        .first()
    )

    # create_password_reset_token returns None if no user exists
    token = create_password_reset_token(
        db,
        data.email,
    )

    organization_id = 1
    user_id = None
    if user is not None:
        membership = (
            db.query(OrganizationMember)
            .filter(OrganizationMember.user_id == user.id)
            .first()
        )
        if membership:
            organization_id = membership.organization_id
        user_id = user.id

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=user_id,
        action="PASSWORD_RESET_REQUEST",
        resource_type="USER",
        resource_id=str(user_id) if user_id else None,
        description="Password reset requested.",
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
        "message": "If an account exists for this email, a password reset link has been generated.",
        "reset_token": token,
    }


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
)
def reset_password_endpoint(
    data: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    # Resolve the user behind the (still-valid) token BEFORE consuming it
    from app.utils.reset_token import hash_reset_token
    from app.models.password_reset_token import PasswordResetToken
    from app.models.user import User
    from app.models.organization_member import OrganizationMember

    token_hash = hash_reset_token(data.token)
    reset_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,
        )
        .first()
    )

    user_id = reset_token.user_id if reset_token else None
    organization_id = 1
    if user_id is not None:
        membership = (
            db.query(OrganizationMember)
            .filter(OrganizationMember.user_id == user_id)
            .first()
        )
        if membership:
            organization_id = membership.organization_id

    reset_password(
        db,
        data.token,
        data.new_password,
    )

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=user_id,
        action="PASSWORD_RESET",
        resource_type="USER",
        resource_id=str(user_id) if user_id else None,
        description="Password has been reset successfully.",
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
        "message": "Password has been reset successfully.",
    }