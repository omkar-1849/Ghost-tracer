from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.user import User
from app.schemas.website_schema import WebsiteCreate, WebsiteUpdate, WebsiteResponse
from app.services import website_service
from app.utils.security import get_current_user

router = APIRouter(
    prefix="/websites",
    tags=["Websites"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=WebsiteResponse, status_code=201)
def create_website(
    website: WebsiteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return website_service.create_website(db, website, current_user.id)


@router.get("/search", response_model=List[WebsiteResponse])
def search_websites(
    q: str = Query(
        ...,
        min_length=1,
        description="Search term for website name, url, domain, owner, or tags"
    ),
    db: Session = Depends(get_db)
):
    return website_service.search_websites(db, q)


@router.get("", response_model=List[WebsiteResponse])
def get_all_websites(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return website_service.get_all_websites(db, skip=skip, limit=limit)


@router.get("/{website_id}", response_model=WebsiteResponse)
def get_website(
    website_id: int,
    db: Session = Depends(get_db)
):
    return website_service.get_website(db, website_id)


@router.put("/{website_id}", response_model=WebsiteResponse)
def update_website(
    website_id: int,
    website: WebsiteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return website_service.update_website(db, website_id, website, current_user.id)


@router.delete("/{website_id}")
def delete_website(
    website_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return website_service.delete_website(db, website_id, current_user.id)


# -------------------------------
# Website Verification
# -------------------------------

@router.get("/{website_id}/verification-token")
def get_verification_token(
    website_id: int,
    db: Session = Depends(get_db)
):
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
    db: Session = Depends(get_db)
):
    return website_service.verify_website(
        db,
        website_id,
        method
    )