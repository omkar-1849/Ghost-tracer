from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException
import urllib.parse
import socket

from app.models.website import Website
from app.schemas.website_schema import WebsiteCreate, WebsiteUpdate

def extract_domain(url: str) -> str:
    try:
        parsed_uri = urllib.parse.urlparse(url)
        domain = parsed_uri.netloc
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain
    except Exception:
        return ""

def resolve_ip(domain: str) -> str:
    try:
        # Avoid blocking indefinitely; you can use a quick DNS resolution
        # In a real app you might do this async, but sync is fine for MVP
        ip = socket.gethostbyname(domain)
        return ip
    except Exception:
        return None

def create_website(db: Session, data: WebsiteCreate) -> Website:
    # Check if URL already exists
    existing = db.query(Website).filter(Website.url == data.url).first()
    if existing:
        raise HTTPException(status_code=400, detail="Website with this URL already exists.")
        
    domain = extract_domain(data.url)
    ip_address = resolve_ip(domain) if domain else None
    
    website = Website(
        name=data.name,
        url=data.url,
        description=data.description,
        environment=data.environment,
        status=data.status,
        owner=data.owner,
        favicon_url=data.favicon_url,
        monitoring_enabled=data.monitoring_enabled,
        tags=data.tags,
        notes=data.notes,
        health_status=data.health_status,
        domain=domain,
        ip_address=ip_address,
        security_score=100  # Default initial score
    )
    
    db.add(website)
    db.commit()
    db.refresh(website)
    return website

def get_website(db: Session, website_id: int) -> Website:
    website = db.query(Website).filter(Website.id == website_id).first()
    if not website:
        raise HTTPException(status_code=404, detail="Website not found.")
    return website

def get_all_websites(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Website).order_by(Website.created_at.desc()).offset(skip).limit(limit).all()

def update_website(db: Session, website_id: int, data: WebsiteUpdate) -> Website:
    website = get_website(db, website_id)
    
    update_data = data.model_dump(exclude_unset=True)
    
    # If URL changes, recalculate domain and IP
    if "url" in update_data and update_data["url"] != website.url:
        existing = db.query(Website).filter(Website.url == update_data["url"]).first()
        if existing and existing.id != website_id:
            raise HTTPException(status_code=400, detail="URL already associated with another website.")
            
        new_domain = extract_domain(update_data["url"])
        update_data["domain"] = new_domain
        update_data["ip_address"] = resolve_ip(new_domain) if new_domain else None
        
    for key, value in update_data.items():
        setattr(website, key, value)
        
    db.commit()
    db.refresh(website)
    return website

def delete_website(db: Session, website_id: int):
    website = get_website(db, website_id)
    db.delete(website)
    db.commit()
    return {"message": "Website successfully deleted."}

def search_websites(db: Session, query: str):
    search = f"%{query}%"
    return db.query(Website).filter(
        or_(
            Website.name.ilike(search),
            Website.url.ilike(search),
            Website.domain.ilike(search),
            Website.owner.ilike(search),
            Website.tags.ilike(search)
        )
    ).order_by(Website.created_at.desc()).all()
