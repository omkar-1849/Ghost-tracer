from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.integration_schema import (
    IntegrationResponse,
    IntegrationKeyResponse,
    RegenerateResponse,
)
from app.services.integration_service import (
    create_integration,
    get_integration,
    regenerate_keys,
    revoke_integration,
)
from app.utils.security import get_current_user


router = APIRouter(
    prefix="/websites",
    tags=["Website Integration"],
)


@router.post(
    "/{website_id}/connect",
    response_model=IntegrationKeyResponse,
)
def connect_website(
    website_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    integration, api_key, api_secret = create_integration(
        db=db,
        website_id=website_id,
        user_id=current_user.id,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get("user-agent"),
    )

    if integration is None:
        raise HTTPException(
            status_code=404,
            detail="Website not found.",
        )

    if api_key is None:
        raise HTTPException(
            status_code=400,
            detail="Website already connected.",
        )

    return {
        "api_key": api_key,
        "api_secret": api_secret,
    }


@router.get(
    "/{website_id}/integration",
    response_model=IntegrationResponse,
)
def get_website_integration(
    website_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    integration = get_integration(
        db,
        website_id,
    )

    if not integration:
        raise HTTPException(
            status_code=404,
            detail="Integration not found.",
        )

    return integration


@router.post(
    "/{website_id}/regenerate-key",
    response_model=RegenerateResponse,
)
def regenerate_website_key(
    website_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = regenerate_keys(
        db=db,
        website_id=website_id,
        user_id=current_user.id,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get("user-agent"),
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Integration not found.",
        )

    _, api_key, api_secret = result

    return {
        "message": "Keys regenerated successfully.",
        "api_key": api_key,
        "api_secret": api_secret,
    }


@router.delete(
    "/{website_id}/disconnect",
)
def disconnect_website(
    website_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = revoke_integration(
        db=db,
        website_id=website_id,
        user_id=current_user.id,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get("user-agent"),
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Integration not found.",
        )

    return {
        "message": "Website disconnected successfully.",
    }