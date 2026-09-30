from app.utils.authorization import TenantContext, get_tenant_context, require_roles, scoped_get
from app.models.website import Website
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.schemas.website_schema import WebsiteCreate, WebsiteUpdate, WebsiteResponse
from app.services import website_service

router = APIRouter(
    prefix="/websites",
    tags=["Websites"],
)


@router.post("", response_model=WebsiteResponse, status_code=201)
def create_website(
    website: WebsiteCreate,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db)
):
    return website_service.create_website(db, website, ctx.user.id, organization_id=ctx.organization_id)


@router.get("/search", response_model=List[WebsiteResponse])
def search_websites(
    q: str = Query(
        ...,
        min_length=1,
        description="Search term for website name, url, domain, owner, or tags"
    ),
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    return website_service.search_websites(db, q, organization_id=ctx.organization_id)


@router.get("", response_model=List[WebsiteResponse])
def get_all_websites(
    skip: int = 0,
    limit: int = 100,
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    return website_service.get_all_websites(db, organization_id=ctx.organization_id, skip=skip, limit=limit)


@router.get("/{website_id}", response_model=WebsiteResponse)
def get_website(
    website_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):

    scoped_get(db, Website, website_id, ctx)
    return website_service.get_website(db, website_id)


@router.put("/{website_id}", response_model=WebsiteResponse)
def update_website(
    website_id: int,
    website: WebsiteUpdate,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db)
):

    scoped_get(db, Website, website_id, ctx)
    return website_service.update_website(db, website_id, website, ctx.user.id)


@router.delete("/{website_id}")
def delete_website(
    website_id: int,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db)
):

    scoped_get(db, Website, website_id, ctx)
    return website_service.delete_website(db, website_id, ctx.user.id)


# -------------------------------
# Website Verification
# -------------------------------

@router.get("/{website_id}/verification-token")
def get_verification_token(
    website_id: int,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db)
):

    scoped_get(db, Website, website_id, ctx)
    website = website_service.get_website(db, website_id)

    return {
        "website_id": website.id,
        "verified": website.verified,
        "verification_method": website.verification_method,
        "verification_token": website.verification_token,
    }


@router.post("/{website_id}/verify/{method}")
def verify_website(
    website_id: int,
    method: str,
    ctx: TenantContext = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db)
):

    scoped_get(db, Website, website_id, ctx)
    return website_service.verify_website(
        db,
        website_id,
        method
    )