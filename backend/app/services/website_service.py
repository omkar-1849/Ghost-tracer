from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException
import urllib.parse
import secrets

import dns.resolver
from app.utils.destination import validate_destination, safe_fetch, DestinationError
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

from app.models.website import Website
from app.schemas.website_schema import WebsiteCreate, WebsiteUpdate
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id


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


def create_website(db: Session, data: WebsiteCreate, user_id: int | None = None, organization_id: int | None = None) -> Website:
    try:
        destination = validate_destination(data.url)
    except DestinationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    existing = db.query(Website).filter(Website.url == destination.url).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Website with this URL already exists."
        )

    domain = destination.hostname
    ip_address = destination.addresses[0]

    website = Website(
        organization_id=organization_id,
        name=data.name,
        url=destination.url,
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
    db.flush()
    db.refresh(website)

    create_audit_log(
        db=db,
        organization_id=organization_id or resolve_audit_organization_id(db, user_id),
        user_id=user_id,
        action="CREATE_WEBSITE",
        resource_type="WEBSITE",
        resource_id=str(website.id),
        description=f"Website '{website.name}' created.",
    )

    return website


def get_website(db: Session, website_id: int) -> Website:
    website = db.query(Website).filter(Website.id == website_id).first()
    if not website:
        raise HTTPException(status_code=404, detail="Website not found.")
    return website


def get_all_websites(db: Session, organization_id: int | None = None, skip: int = 0, limit: int = 100):
    query = db.query(Website)
    if organization_id is not None:
        query = query.filter(Website.organization_id == organization_id)
    return (
        query
        .order_by(Website.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_website(db: Session, website_id: int, data: WebsiteUpdate, user_id: int | None = None) -> Website:
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

        try:
            destination = validate_destination(update_data["url"])
        except DestinationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        update_data["url"] = destination.url
        update_data["domain"] = destination.hostname
        update_data["ip_address"] = destination.addresses[0]
        website.verified = False
        website.verification_method = None
        website.verified_at = None
        website.verified_target = None
        website.verified_addresses = None
        website.verification_token = generate_verification_token()

    for key, value in update_data.items():
        setattr(website, key, value)

    db.flush()
    db.refresh(website)

    create_audit_log(
        db=db,
        organization_id=resolve_audit_organization_id(db, user_id),
        user_id=user_id,
        action="UPDATE_WEBSITE",
        resource_type="WEBSITE",
        resource_id=str(website.id),
        description=f"Website '{website.name}' updated.",
    )

    return website


def delete_website(db: Session, website_id: int, user_id: int | None = None):
    website = get_website(db, website_id)

    site_id = website.id
    site_name = website.name

    db.delete(website)
    db.flush()

    create_audit_log(
        db=db,
        organization_id=resolve_audit_organization_id(db, user_id),
        user_id=user_id,
        action="DELETE_WEBSITE",
        resource_type="WEBSITE",
        resource_id=str(site_id),
        description=f"Website '{site_name}' deleted.",
    )

    return {"message": "Website successfully deleted."}


def search_websites(db: Session, query: str, organization_id: int | None = None):
    search = f"%{query}%"

    q = (
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
    )
    if organization_id is not None:
        q = q.filter(Website.organization_id == organization_id)

    return q.order_by(Website.created_at.desc()).all()


def verify_website(db: Session, website_id: int, method: str):
    website = get_website(db, website_id)
    method = method.lower()
    if method not in {"dns", "html", "meta"}:
        raise HTTPException(status_code=400, detail="Invalid verification method.")

    # Failure also clears prior authority; return normally so the transaction
    # persists the invalidation instead of rolling it back as an HTTP error.
    website.verified = False
    website.verification_method = None
    website.verified_at = None
    website.verified_target = None
    website.verified_addresses = None
    token = website.verification_token
    verified = False
    try:
        destination = validate_destination(website.url)
        if not token:
            raise DestinationError("Ownership token is missing.")
        if method == "dns":
            answers = dns.resolver.resolve(destination.hostname, "TXT", lifetime=5)
            for record in answers:
                text = b"".join(record.strings).decode("utf-8", errors="replace")
                if text == token:
                    verified = True
                    break
        else:
            url = website.url if method == "meta" else urllib.parse.urljoin(website.url, "/sentinel_verify.html")
            response = safe_fetch(url)
            # Pin the verified scope to the addresses actually fetched.
            destination = response.destination
            if response.status_code == 200:
                if method == "html":
                    verified = token in response.text
                else:
                    soup = BeautifulSoup(response.text, "html.parser")
                    tag = soup.find("meta", attrs={"name": "sentinel-verification"})
                    verified = bool(tag and tag.get("content") == token)
        if verified:
            website.verified = True
            website.verification_method = method
            website.verified_at = datetime.utcnow()
            website.verified_target = website.url
            website.verified_addresses = list(destination.addresses)
    except (DestinationError, dns.exception.DNSException, ValueError, OSError):
        verified = False
    db.flush()
    return {"success": verified, "message": "Website ownership verified successfully." if verified else "Verification failed."}
