from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException
import urllib.parse
import socket
import secrets

import requests
import dns.resolver
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

from app.models.website import Website
from app.schemas.website_schema import WebsiteCreate, WebsiteUpdate


def generate_verification_token():
    return f"SENTINEL_{secrets.token_urlsafe(16).upper()}"


def extract_domain(url: str) -> str:
    try:
        parsed_uri = urllib.parse.urlparse(url)
        domain = parsed_uri.netloc
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def resolve_ip(domain: str) -> str:
    try:
        return socket.gethostbyname(domain)
    except Exception:
        return None


def create_website(db: Session, data: WebsiteCreate) -> Website:
    existing = db.query(Website).filter(Website.url == data.url).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Website with this URL already exists."
        )

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
        security_score=100,

        verified=False,
        verification_method=None,
        verification_token=generate_verification_token(),
        verified_at=None,
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
    return (
        db.query(Website)
        .order_by(Website.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_website(db: Session, website_id: int, data: WebsiteUpdate) -> Website:
    website = get_website(db, website_id)

    update_data = data.model_dump(exclude_unset=True)

    if "url" in update_data and update_data["url"] != website.url:
        existing = db.query(Website).filter(
            Website.url == update_data["url"]
        ).first()

        if existing and existing.id != website_id:
            raise HTTPException(
                status_code=400,
                detail="URL already associated with another website."
            )

        new_domain = extract_domain(update_data["url"])
        update_data["domain"] = new_domain
        update_data["ip_address"] = (
            resolve_ip(new_domain) if new_domain else None
        )

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

    return (
        db.query(Website)
        .filter(
            or_(
                Website.name.ilike(search),
                Website.url.ilike(search),
                Website.domain.ilike(search),
                Website.owner.ilike(search),
                Website.tags.ilike(search),
            )
        )
        .order_by(Website.created_at.desc())
        .all()
    )


def verify_website(db: Session, website_id: int, method: str):
    website = get_website(db, website_id)

    method = method.lower()

    if method not in ["dns", "html", "meta"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification method."
        )

    token = website.verification_token
    verified = False

    try:
        if method == "dns":
            answers = dns.resolver.resolve(website.domain, "TXT")

            for record in answers:
                if token in "".join(record.strings.decode() if isinstance(record.strings, bytes) else str(record)):
                    verified = True
                    break

        elif method == "html":
            response = requests.get(
                website.url.rstrip("/") + "/sentinel_verify.html",
                timeout=10
            )

            if response.status_code == 200 and token in response.text:
                verified = True

        elif method == "meta":
            response = requests.get(website.url, timeout=10)

            soup = BeautifulSoup(response.text, "html.parser")

            tag = soup.find(
                "meta",
                attrs={"name": "sentinel-verification"}
            )

            if tag and tag.get("content") == token:
                verified = True

    except Exception:
        verified = False

    if verified:
        website.verified = True
        website.verification_method = method
        website.verified_at = datetime.utcnow() + timedelta(hours=5, minutes=30)

        db.commit()
        db.refresh(website)

        return {
            "success": True,
            "message": "Website ownership verified successfully."
        }

    return {
        "success": False,
        "message": "Verification failed."
    }