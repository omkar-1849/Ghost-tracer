from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException
import urllib.parse
import secrets

import dns.resolver
import os
from app.utils.destination import validate_destination, safe_fetch, DestinationError, get_configured_protected_target
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

from app.models.website import Website
from app.schemas.website_schema import WebsiteCreate, WebsiteUpdate
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id


import logging
logger = logging.getLogger("sentinel.website_service")

MAX_ASSETS_PER_ORGANIZATION = int(os.environ.get("MAX_ASSETS_PER_ORGANIZATION", "10"))


def generate_verification_token():
    return f"SENTINEL_{secrets.token_urlsafe(16).upper()}"


def get_or_create_verification_token(db: Session, website: Website) -> str:
    if not website.verification_token:
        website.verification_token = generate_verification_token()
        db.flush()
    return website.verification_token


def normalize_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    if ":" in netloc:
        host, port = netloc.split(":", 1)
        if (scheme == "http" and port == "80") or (scheme == "https" and port == "443"):
            netloc = host
    path = parsed.path or "/"
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    return urllib.parse.urlunsplit((scheme, netloc, path, parsed.query, parsed.fragment))


def extract_domain(url: str) -> str:
    try:
        parsed_uri = urllib.parse.urlparse(url)
        domain = parsed_uri.netloc
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def is_allowed_protected_target(destination) -> bool:
    """Validates that the target is the configured protected application or in allowed targets."""
    allowed_raw = os.getenv("SENTINEL_ALLOWED_TARGET_HOSTS", "").strip()
    if not allowed_raw or allowed_raw == "*":
        return True
    allowed_hosts = {
        h.strip().lower() for h in allowed_raw.split(",") if h.strip()
    }
    if "*" in allowed_hosts:
        return True
    if destination.hostname in allowed_hosts or f"{destination.hostname}:{destination.port}" in allowed_hosts:
        return True

    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    if is_production:
        if os.getenv("SENTINEL_PROTECTED_APP_URL"):
            logger.warning("SENTINEL_PROTECTED_APP_URL is ignored in production environment.")
        return False

    protected = get_configured_protected_target()
    if protected:
        prot_scheme, prot_host, prot_port = protected
        if destination.scheme == prot_scheme and destination.port == prot_port:
            if prot_host in ("localhost", "127.0.0.1", "::1") and destination.hostname in ("localhost", "127.0.0.1", "::1"):
                return True
            if destination.hostname == prot_host:
                return True
    return False


def create_website(db: Session, data: WebsiteCreate, user_id: int | None = None, organization_id: int | None = None) -> Website:
    try:
        destination = validate_destination(data.url)
    except DestinationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not is_allowed_protected_target(destination):
        raise HTTPException(
            status_code=400,
            detail="Only the configured protected application asset is permitted. Arbitrary external websites are restricted."
        )

    normalized_url = normalize_url(destination.url)

    # Enforce quota of non-archived assets per organization
    if organization_id is not None:
        active_assets_count = db.query(Website).filter(
            Website.organization_id == organization_id,
            Website.archived_at.is_(None),
        ).count()
        if active_assets_count >= MAX_ASSETS_PER_ORGANIZATION:
            raise HTTPException(
                status_code=400,
                detail="Asset limit reached for this organization.",
            )

    # Scoped duplicate check for organization's non-archived assets
    duplicate_query = db.query(Website).filter(
        Website.url == normalized_url,
        Website.archived_at.is_(None),
    )
    if organization_id is not None:
        duplicate_query = duplicate_query.filter(Website.organization_id == organization_id)
    if duplicate_query.first():
        raise HTTPException(
            status_code=400,
            detail="Website with this URL already exists.",
        )

    domain = destination.hostname
    ip_address = destination.addresses[0]
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    exposure = data.exposure or "public"
    is_local = (not is_production) and (exposure != "internal") and (destination.hostname in ("localhost", "127.0.0.1", "::1"))

    website = Website(
        organization_id=organization_id,
        name=data.name,
        url=normalized_url,
        description=data.description,
        exposure=exposure,
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

        verified=True if is_local else False,
        verification_method="local" if is_local else None,
        verification_token=generate_verification_token(),
        verified_at=datetime.utcnow() if is_local else None,
        verified_target=normalized_url if is_local else None,
        verified_addresses=list(destination.addresses) if is_local else None,
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

    _attach_summary_fields(db, [website])
    return website


def _attach_summary_fields(db: Session, websites: list[Website]):
    if not websites:
        return
    from app.services.collector_service import summarize_assets, derive_scan_authorization
    summaries = summarize_assets(db, [w.id for w in websites])
    for w in websites:
        summary = summaries.get(w.id, {})
        setattr(w, "monitoring_status", summary.get("monitoring_status", "not_connected"))
        setattr(w, "collectors_total", summary.get("collectors_total", 0))
        setattr(w, "collectors_online", summary.get("collectors_online", 0))
        setattr(w, "last_telemetry_at", summary.get("last_telemetry_at"))
        setattr(w, "scan_authorization", derive_scan_authorization(w))


def get_website(db: Session, website_id: int) -> Website:
    website = db.query(Website).filter(
        Website.id == website_id,
        Website.archived_at.is_(None),
    ).first()
    if not website:
        raise HTTPException(status_code=404, detail="Website not found.")
    if not website.verification_token:
        website.verification_token = generate_verification_token()
        db.flush()
    _attach_summary_fields(db, [website])
    return website


def get_all_websites(db: Session, organization_id: int | None = None, skip: int = 0, limit: int = 100, include_archived: bool = False):
    query = db.query(Website)
    if not include_archived:
        query = query.filter(Website.archived_at.is_(None))
    if organization_id is not None:
        query = query.filter(Website.organization_id == organization_id)
    results = (
        query
        .order_by(Website.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    _attach_summary_fields(db, results)
    return results



def update_website(db: Session, website_id: int, data: WebsiteUpdate, user_id: int | None = None) -> Website:
    website = get_website(db, website_id)

    update_data = data.model_dump(exclude_unset=True)

    old_exposure = website.exposure
    new_exposure = update_data.get("exposure", old_exposure)
    if old_exposure == "internal" and new_exposure == "public":
        website.verified = False
        website.verification_method = None
        website.verified_at = None
        website.verified_target = None
        website.verified_addresses = None
        website.verification_token = generate_verification_token()

    if "url" in update_data and update_data["url"] != website.url:
        try:
            destination = validate_destination(update_data["url"])
        except DestinationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        if not is_allowed_protected_target(destination):
            raise HTTPException(
                status_code=400,
                detail="Only the configured protected application asset is permitted. Arbitrary external websites are restricted."
            )

        normalized_url = normalize_url(destination.url)
        existing = db.query(Website).filter(
            Website.organization_id == website.organization_id,
            Website.url == normalized_url,
            Website.archived_at.is_(None),
            Website.id != website_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="URL already associated with another website."
            )

        update_data["url"] = normalized_url
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

    _attach_summary_fields(db, [website])
    return website


def delete_website(db: Session, website_id: int, user_id: int | None = None):
    website = get_website(db, website_id)
    if website.archived_at is not None:
        raise HTTPException(status_code=404, detail="Website not found.")

    site_id = website.id
    site_name = website.name

    website.archived_at = datetime.utcnow()
    from app.models.integration import Integration
    from app.models.enrollment_token import EnrollmentToken
    integrations = db.query(Integration).filter(Integration.website_id == site_id).all()
    for integration in integrations:
        integration.status = "Revoked"
        integration.revoked_at = datetime.utcnow()
        integration.previous_key_hash = None
        integration.previous_key_expires_at = None

    tokens = db.query(EnrollmentToken).filter(EnrollmentToken.website_id == site_id, EnrollmentToken.revoked_at.is_(None)).all()
    for token in tokens:
        token.revoked_at = datetime.utcnow()

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
            Website.archived_at.is_(None),
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

    results = q.order_by(Website.created_at.desc()).all()
    _attach_summary_fields(db, results)
    return results



def verify_website(db: Session, website_id: int, method: str):
    website = get_website(db, website_id)
    method = method.lower()
    if method not in {"dns", "html", "meta", "local"}:
        raise HTTPException(status_code=400, detail="Invalid verification method.")

    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    if method == "local" and is_production:
        raise HTTPException(status_code=400, detail="Local verification is not available in production.")

    # Failure also clears prior authority; return normally so the transaction
    # persists the invalidation instead of rolling it back as an HTTP error.
    website.verified = False
    website.verification_method = None
    website.verified_at = None
    website.verified_target = None
    website.verified_addresses = None
    token = get_or_create_verification_token(db, website)
    verified = False
    try:
        destination = validate_destination(website.url)
        is_loopback = getattr(destination, "hostname", "") in ("localhost", "127.0.0.1", "::1")

        if not token:
            raise DestinationError("Ownership token is missing.")

        if method == "local":
            if (not is_production) and is_loopback:
                verified = True
            else:
                raise HTTPException(status_code=400, detail="Local verification is only allowed for loopback targets in non-production.")
        elif method == "dns":
            if is_loopback:
                # Loopback targets cannot be verified via public DNS TXT records
                verified = False
            else:
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
            website.verified_addresses = list(getattr(destination, "addresses", ["127.0.0.1"]))
    except (DestinationError, dns.exception.DNSException, ValueError, OSError):
        verified = False
    db.flush()
    return {"success": verified, "message": "Website ownership verified successfully." if verified else "Verification failed."}
