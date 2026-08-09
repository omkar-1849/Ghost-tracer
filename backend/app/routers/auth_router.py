from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.utils.security import get_current_user
from app.services.session_service import create_session
from app.database.database import get_db
from app.schemas.auth_schema import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_user_token,
    register_user,
)

from app.schemas.auth_schema import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)

from app.services.auth_service import (
    authenticate_user,
    create_password_reset_token,
    create_user_token,
    register_user,
    reset_password,
)






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
    db: Session = Depends(get_db),
):
    return register_user(db, data)

@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user=Depends(get_current_user),
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
    db: Session = Depends(get_db),
):
    token = create_password_reset_token(
        db,
        data.email,
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
    db: Session = Depends(get_db),
):
    reset_password(
        db,
        data.token,
        data.new_password,
    )

    return {
        "message": "Password has been reset successfully.",
    }