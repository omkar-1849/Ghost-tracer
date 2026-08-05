from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.schemas.website_schema import WebsiteCreate, WebsiteUpdate, WebsiteResponse
from app.services import website_service

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
    db: Session = Depends(get_db)
):
    return website_service.create_website(db, website)


@router.get("/search", response_model=List[WebsiteResponse])
def search_websites(
    q: str = Query(..., min_length=1, description="Search term for website name, url, domain, owner, or tags"), 
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
    db: Session = Depends(get_db)
):
    return website_service.update_website(db, website_id, website)


@router.delete("/{website_id}")
def delete_website(
    website_id: int, 
    db: Session = Depends(get_db)
):
    return website_service.delete_website(db, website_id)
