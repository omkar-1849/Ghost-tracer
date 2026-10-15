from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.website import Website
from app.schemas.collector_schema import (
    CollectorResponse,
    RotateKeyRequest,
    RotateKeyResponse,
)
from app.schemas.enrollment_token_schema import (
    EnrollmentTokenCreate,
    EnrollmentTokenCreateResponse,
    EnrollmentTokenResponse,
    EnrollmentTokenStatusResponse,
)
from app.services.collector_service import (
    disable_collector,
    enable_collector,
    list_collectors,
    revoke_collector,
    rotate_collector_key,
)
from app.services.enrollment_service import (
    create_tenant_token,
    create_token,
    get_token_status,
    list_tokens,
    revoke_token,
)
from app.utils.authorization import (
    TenantContext,
    get_tenant_context,
    require_roles,
    scoped_get,
)

router = APIRouter(prefix="/websites", tags=["Collector Management"])
tenant_enrollment_router = APIRouter(prefix="/enrollment-tokens", tags=["Enrollment Tokens"])


@tenant_enrollment_router.post(
    "",
    response_model=EnrollmentTokenCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tenant_scoped_enrollment_token(
    body: EnrollmentTokenCreate,
    request: Request,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    token_row, raw_token = create_tenant_token(
        db=db,
        organization_id=ctx.organization_id,
        user_id=ctx.user.id,
        label=body.label,
        expires_in_hours=body.expires_in_hours,
        max_uses=body.max_uses,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {
        "id": token_row.id,
        "token": raw_token,
        "token_prefix": token_row.token_prefix,
        "expires_at": token_row.expires_at,
        "max_uses": token_row.max_uses,
        "website_id": None,
    }


@tenant_enrollment_router.get(
    "/{token_id}/status",
    response_model=EnrollmentTokenStatusResponse,
)
def get_enrollment_token_status_endpoint(
    token_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    return get_token_status(
        db=db,
        organization_id=ctx.organization_id,
        token_id=token_id,
    )



# --- Enrollment Tokens ---

@router.post(
    "/{website_id}/enrollment-tokens",
    response_model=EnrollmentTokenCreateResponse,
    status_code=201,
)
def create_enrollment_token(
    website_id: int,
    body: EnrollmentTokenCreate,
    request: Request,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    website = scoped_get(db, Website, website_id, ctx)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    token_row, raw_token = create_token(
        db=db,
        website=website,
        user_id=ctx.user.id,
        label=body.label,
        expires_in_hours=body.expires_in_hours,
        max_uses=body.max_uses,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {
        "id": token_row.id,
        "token": raw_token,
        "token_prefix": token_row.token_prefix,
        "expires_at": token_row.expires_at,
        "max_uses": token_row.max_uses,
    }


@router.get(
    "/{website_id}/enrollment-tokens",
    response_model=List[EnrollmentTokenResponse],
)
def get_enrollment_tokens(
    website_id: int,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    scoped_get(db, Website, website_id, ctx)
    return list_tokens(db, website_id)


@router.delete(
    "/{website_id}/enrollment-tokens/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_enrollment_token(
    website_id: int,
    token_id: int,
    request: Request,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    scoped_get(db, Website, website_id, ctx)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    revoke_token(
        db=db,
        website_id=website_id,
        token_id=token_id,
        user_id=ctx.user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Collectors ---

@router.get(
    "/{website_id}/collectors",
    response_model=List[CollectorResponse],
)
def get_asset_collectors(
    website_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    scoped_get(db, Website, website_id, ctx)
    return list_collectors(db, website_id)


@router.post(
    "/{website_id}/collectors/{collector_id}/rotate-key",
    response_model=RotateKeyResponse,
)
def rotate_key(
    website_id: int,
    collector_id: int,
    request: Request,
    body: RotateKeyRequest = RotateKeyRequest(),
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    scoped_get(db, Website, website_id, ctx)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    _, new_key = rotate_collector_key(
        db=db,
        website_id=website_id,
        collector_id=collector_id,
        grace_seconds=body.grace_seconds,
        user_id=ctx.user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    return {
        "api_key": new_key,
        "message": "Key rotated successfully.",
    }


@router.post(
    "/{website_id}/collectors/{collector_id}/disable",
)
def disable_asset_collector(
    website_id: int,
    collector_id: int,
    request: Request,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    scoped_get(db, Website, website_id, ctx)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    disable_collector(
        db=db,
        website_id=website_id,
        collector_id=collector_id,
        user_id=ctx.user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return {"message": "Collector disabled successfully."}


@router.post(
    "/{website_id}/collectors/{collector_id}/enable",
)
def enable_asset_collector(
    website_id: int,
    collector_id: int,
    request: Request,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    scoped_get(db, Website, website_id, ctx)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    enable_collector(
        db=db,
        website_id=website_id,
        collector_id=collector_id,
        user_id=ctx.user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return {"message": "Collector enabled successfully."}


@router.post(
    "/{website_id}/collectors/{collector_id}/revoke",
)
def revoke_asset_collector(
    website_id: int,
    collector_id: int,
    request: Request,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    scoped_get(db, Website, website_id, ctx)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    revoke_collector(
        db=db,
        website_id=website_id,
        collector_id=collector_id,
        user_id=ctx.user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return {"message": "Collector permanently revoked."}
