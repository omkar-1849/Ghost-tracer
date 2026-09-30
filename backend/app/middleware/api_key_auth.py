import hashlib
from datetime import datetime, timezone
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.integration import Integration
from app.models.website import Website
from app.models.audit_log import AuditLog


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def verify_api_key(x_api_key: str | None = Header(None, alias="X-API-Key"), db: Session = Depends(get_db)):
    if not isinstance(x_api_key, str) or not 16 <= len(x_api_key) <= 256:
        raise HTTPException(401, "Invalid API Key")
    # Hash equality is sufficient for high-entropy tokens. No global validator,
    # flush, eager relationship load or audit may run within bootstrap scope.
    db.info["system_scope"] = True
    try:
        with db.no_autoflush:
            integration = db.query(Integration).filter(
                Integration.api_key_hash == hash_api_key(x_api_key),
                Integration.status == "Connected",
            ).first()
    finally:
        db.info["system_scope"] = False
    if integration is None:
        raise HTTPException(401, "Invalid API Key")
    # System scope is off: the trusted Integration row is already in the
    # session identity map, so this navigation needs no extra query.
    org = integration.organization_id
    if not org:
        raise HTTPException(401, "Invalid API Key")
    if db.info.get("organization_id") not in (None, org):
        raise HTTPException(403, "Cannot change tenant during a request")
    db.info["organization_id"] = org
    website = db.query(Website).filter(Website.id == integration.website_id, Website.organization_id == org).first()
    if website is None:
        raise HTTPException(401, "Invalid API Key")
    db.info["actor_id"] = None
    integration.last_used = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(AuditLog(organization_id=org, action="API_KEY_USED", resource_type="INTEGRATION",
                    resource_id=str(integration.id), description="Integration authenticated for telemetry ingestion."))
    db.flush()
    return integration


validate_api_key_header = verify_api_key
