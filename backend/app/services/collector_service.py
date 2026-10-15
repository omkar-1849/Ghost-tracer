import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enrollment_token import EnrollmentToken
from app.models.integration import Integration
from app.models.website import Website
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id

MAX_COLLECTORS_PER_ASSET = 20
KEY_ROTATION_DEFAULT_GRACE_SECONDS = 900
KEY_ROTATION_MAX_GRACE_SECONDS = 3600
COLLECTOR_HEARTBEAT_INTERVAL_SECONDS = 60
COLLECTOR_OFFLINE_AFTER_SECONDS = 180
BATCH_LIMITS = {
    "max_items": 100,
    "max_body_bytes": 1048576,
    "max_decompressed_bytes": 5242880,
}


def derive_collector_status(collector: Integration, now: Optional[datetime] = None) -> str:
    """Derive collector runtime status (single source of truth)."""
    if collector.status == "Revoked":
        return "revoked"
    if collector.status == "Disabled":
        return "disabled"
    if collector.last_heartbeat_at is None and collector.last_used is None:
        return "pending"

    if now is None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

    last_seen_candidates = [
        dt for dt in (collector.last_heartbeat_at, collector.last_used) if dt is not None
    ]
    max_last_seen = max(last_seen_candidates)
    delta = (now - max_last_seen).total_seconds()
    if delta <= COLLECTOR_OFFLINE_AFTER_SECONDS:
        return "online"
    return "offline"


def derive_asset_monitoring_status(
    collectors: List[Integration],
    now: Optional[datetime] = None,
) -> Tuple[str, int, int, Optional[datetime]]:
    """Derive asset monitoring status from its non-revoked, non-disabled collectors.

    Returns (monitoring_status, collectors_total, collectors_online, last_telemetry_at).
    """
    if now is None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

    active_collectors = [
        c for c in collectors if c.status not in ("Revoked", "Disabled")
    ]
    total = len(active_collectors)
    if total == 0:
        return "not_connected", 0, 0, None

    seen_any = False
    online_count = 0
    all_last_used = []

    for c in active_collectors:
        if c.last_heartbeat_at is not None or c.last_used is not None:
            seen_any = True
        if c.last_used is not None:
            all_last_used.append(c.last_used)
        st = derive_collector_status(c, now=now)
        if st == "online":
            online_count += 1

    last_telemetry_at = max(all_last_used) if all_last_used else None

    if not seen_any:
        status = "waiting"
    elif online_count == total:
        status = "active"
    elif online_count > 0:
        status = "degraded"
    else:
        status = "offline"

    return status, total, online_count, last_telemetry_at


def derive_scan_authorization(website: Website) -> str:
    if getattr(website, "exposure", "public") == "internal":
        return "not_available"
    return "verified" if getattr(website, "verified", False) else "unverified"


def summarize_assets(db: Session, website_ids: List[int]) -> Dict[int, Dict[str, Any]]:
    """Batch-computes collector summaries for a list of website IDs to avoid N+1 queries."""
    if not website_ids:
        return {}

    collectors = (
        db.query(Integration)
        .filter(Integration.website_id.in_(website_ids))
        .all()
    )

    by_site: Dict[int, List[Integration]] = {wid: [] for wid in website_ids}
    for c in collectors:
        if c.website_id in by_site:
            by_site[c.website_id].append(c)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    result = {}
    for wid, site_collectors in by_site.items():
        mon_status, total, online, last_telemetry = derive_asset_monitoring_status(
            site_collectors, now=now
        )
        result[wid] = {
            "monitoring_status": mon_status,
            "collectors_total": total,
            "collectors_online": online,
            "last_telemetry_at": last_telemetry,
        }
    return result


def enroll_collector(
    db: Session,
    raw_token: str,
    name: Optional[str] = None,
    kind: str = "daemon",
    version: Optional[str] = None,
    hostname: Optional[str] = None,
    client_ip: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute the exact machine-plane collector enrollment sequence (§7.6)."""
    if not isinstance(raw_token, str) or len(raw_token) < 16:
        raise HTTPException(status_code=401, detail="Invalid or expired enrollment token")

    if kind not in ("daemon", "nginx", "sdk", "legacy"):
        raise HTTPException(status_code=401, detail="Invalid or expired enrollment token")

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Step 3: Atomic conditional update on enrollment_tokens in system scope
    db.info["system_scope"] = True
    try:
        with db.no_autoflush:
            updated_count = (
                db.query(EnrollmentToken)
                .filter(
                    EnrollmentToken.token_hash == token_hash,
                    EnrollmentToken.revoked_at.is_(None),
                    EnrollmentToken.expires_at > now,
                    EnrollmentToken.used_count < EnrollmentToken.max_uses,
                )
                .update(
                    {
                        EnrollmentToken.used_count: EnrollmentToken.used_count + 1,
                        EnrollmentToken.last_used_at: now,
                    },
                    synchronize_session=False,
                )
            )
    finally:
        db.info["system_scope"] = False

    if updated_count != 1:
        raise HTTPException(status_code=401, detail="Invalid or expired enrollment token")

    # Step 4: Select token row
    db.info["system_scope"] = True
    try:
        token_row = (
            db.query(EnrollmentToken)
            .filter(EnrollmentToken.token_hash == token_hash)
            .first()
        )
    finally:
        db.info["system_scope"] = False

    if token_row is None:
        raise HTTPException(status_code=401, detail="Invalid or expired enrollment token")

    # Step 5: Load asset and verify not archived
    db.info["system_scope"] = True
    try:
        if token_row.website_id is not None:
            website = (
                db.query(Website)
                .filter(
                    Website.id == token_row.website_id,
                    Website.organization_id == token_row.organization_id,
                )
                .first()
            )
        else:
            # Token-first onboarding: auto-provision protected asset
            clean_host = (hostname or "localhost").strip()
            base_name = token_row.label or (f"Protected Host ({clean_host})" if clean_host else "Protected Host")
            base_domain = clean_host if clean_host else "localhost"
            candidate_url = f"http://{clean_host}"
            suffix = 1
            while (
                db.query(Website)
                .filter(
                    Website.organization_id == token_row.organization_id,
                    Website.url == candidate_url,
                    Website.archived_at.is_(None),
                )
                .first()
                is not None
            ):
                candidate_url = f"http://{clean_host}-{suffix}"
                suffix += 1

            website = Website(
                organization_id=token_row.organization_id,
                name=base_name[:255],
                url=candidate_url[:255],
                domain=base_domain[:255],
                exposure="internal",
                status="Active",
                health_status="Unknown",
                monitoring_enabled=True,
                verified=False,
                verification_token=f"SENTINEL_{secrets.token_urlsafe(16).upper()}",
            )
            db.add(website)
            db.flush()
            db.refresh(website)
            token_row.website_id = website.id
            db.flush()
    finally:
        db.info["system_scope"] = False

    if website is None or website.archived_at is not None:
        # Revert used_count
        db.info["system_scope"] = True
        try:
            token_row.used_count = max(0, token_row.used_count - 1)
            db.flush()
        finally:
            db.info["system_scope"] = False
        raise HTTPException(status_code=401, detail="Invalid or expired enrollment token")

    # Step 6: Check collector limit
    db.info["system_scope"] = True
    try:
        existing_count = (
            db.query(Integration)
            .filter(
                Integration.website_id == token_row.website_id,
                Integration.status != "Revoked",
            )
            .count()
        )
    finally:
        db.info["system_scope"] = False

    if existing_count >= MAX_COLLECTORS_PER_ASSET:
        db.info["system_scope"] = True
        try:
            token_row.used_count = max(0, token_row.used_count - 1)
            db.flush()
        finally:
            db.info["system_scope"] = False
        raise HTTPException(status_code=409, detail="Collector limit reached for this asset")

    # Step 7 & 8: Create runtime credential and Integration
    runtime_key = f"snt_col_{secrets.token_urlsafe(32)}"
    api_key_hash = hashlib.sha256(runtime_key.encode("utf-8")).hexdigest()
    key_prefix = runtime_key[:14]
    collector_name = name or hostname or f"{kind.capitalize()} collector"

    db.info["organization_id"] = token_row.organization_id
    collector = Integration(
        organization_id=token_row.organization_id,
        website_id=token_row.website_id,
        name=collector_name[:100],
        kind=kind,
        api_key_hash=api_key_hash,
        api_secret_hash=None,
        key_prefix=key_prefix,
        enrollment_token_id=token_row.id,
        version=version[:50] if version else None,
        hostname=hostname[:255] if hostname else None,
        last_seen_ip=client_ip[:45] if client_ip else None,
        status="Connected",
    )
    db.add(collector)
    db.flush()

    # Step 9: Audit
    create_audit_log(
        db=db,
        organization_id=token_row.organization_id,
        user_id=None,
        action="COLLECTOR_ENROLLED",
        resource_type="INTEGRATION",
        resource_id=str(collector.id),
        description=f"Collector '{collector.name}' enrolled into protected asset '{website.name}'.",
        ip_address=client_ip,
    )

    return {
        "collector_id": collector.id,
        "api_key": runtime_key,
        "asset_name": website.name,
        "heartbeat_interval_seconds": COLLECTOR_HEARTBEAT_INTERVAL_SECONDS,
        "batch_limits": BATCH_LIMITS,
    }


def list_collectors(db: Session, website_id: int) -> List[Dict[str, Any]]:
    collectors = (
        db.query(Integration)
        .filter(Integration.website_id == website_id)
        .order_by(Integration.created_at.desc())
        .all()
    )
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    result = []
    for c in collectors:
        result.append(
            {
                "id": c.id,
                "website_id": c.website_id,
                "name": c.name or ("Legacy integration" if c.kind == "legacy" else "Collector"),
                "kind": c.kind,
                "status": derive_collector_status(c, now=now),
                "version": c.version,
                "hostname": c.hostname,
                "last_heartbeat_at": c.last_heartbeat_at,
                "last_used": c.last_used,
                "last_seen_ip": c.last_seen_ip,
                "key_prefix": c.key_prefix or ("sk_..." if c.kind == "legacy" else None),
                "created_at": c.created_at,
                "revoked_at": c.revoked_at,
            }
        )
    return result


def rotate_collector_key(
    db: Session,
    website_id: int,
    collector_id: int,
    grace_seconds: int = KEY_ROTATION_DEFAULT_GRACE_SECONDS,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[Integration, str]:
    collector = (
        db.query(Integration)
        .filter(Integration.id == collector_id)
        .first()
    )
    if collector is None or collector.website_id != website_id:
        raise HTTPException(status_code=404, detail="Collector not found.")

    if collector.status == "Revoked":
        raise HTTPException(status_code=400, detail="Cannot rotate key for revoked collector.")

    grace = max(0, min(grace_seconds, KEY_ROTATION_MAX_GRACE_SECONDS))
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if grace > 0:
        collector.previous_key_hash = collector.api_key_hash
        collector.previous_key_expires_at = now + timedelta(seconds=grace)
    else:
        collector.previous_key_hash = None
        collector.previous_key_expires_at = None

    if collector.kind == "legacy":
        new_key = f"sk_{secrets.token_urlsafe(24)}"
    else:
        new_key = f"snt_col_{secrets.token_urlsafe(32)}"

    collector.api_key_hash = hashlib.sha256(new_key.encode("utf-8")).hexdigest()
    collector.key_prefix = new_key[:14]
    collector.updated_at = now
    db.flush()

    org_id = resolve_audit_organization_id(db, user_id) or collector.organization_id
    create_audit_log(
        db=db,
        organization_id=org_id,
        user_id=user_id,
        action="COLLECTOR_KEY_ROTATED",
        resource_type="INTEGRATION",
        resource_id=str(collector.id),
        description=f"Runtime key for collector '{collector.name}' rotated (grace: {grace}s).",
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return collector, new_key


def disable_collector(
    db: Session,
    website_id: int,
    collector_id: int,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Integration:
    collector = (
        db.query(Integration)
        .filter(Integration.id == collector_id)
        .first()
    )
    if collector is None or collector.website_id != website_id:
        raise HTTPException(status_code=404, detail="Collector not found.")

    if collector.status == "Revoked":
        raise HTTPException(status_code=400, detail="Cannot disable revoked collector.")

    collector.status = "Disabled"
    collector.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()

    org_id = resolve_audit_organization_id(db, user_id) or collector.organization_id
    create_audit_log(
        db=db,
        organization_id=org_id,
        user_id=user_id,
        action="COLLECTOR_DISABLED",
        resource_type="INTEGRATION",
        resource_id=str(collector.id),
        description=f"Collector '{collector.name}' disabled.",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return collector


def enable_collector(
    db: Session,
    website_id: int,
    collector_id: int,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Integration:
    collector = (
        db.query(Integration)
        .filter(Integration.id == collector_id)
        .first()
    )
    if collector is None or collector.website_id != website_id:
        raise HTTPException(status_code=404, detail="Collector not found.")

    if collector.status == "Revoked":
        raise HTTPException(status_code=400, detail="Revoked collectors cannot be re-enabled.")

    collector.status = "Connected"
    collector.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()

    org_id = resolve_audit_organization_id(db, user_id) or collector.organization_id
    create_audit_log(
        db=db,
        organization_id=org_id,
        user_id=user_id,
        action="COLLECTOR_ENABLED",
        resource_type="INTEGRATION",
        resource_id=str(collector.id),
        description=f"Collector '{collector.name}' enabled.",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return collector


def revoke_collector(
    db: Session,
    website_id: int,
    collector_id: int,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Integration:
    collector = (
        db.query(Integration)
        .filter(Integration.id == collector_id)
        .first()
    )
    if collector is None or collector.website_id != website_id:
        raise HTTPException(status_code=404, detail="Collector not found.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    collector.status = "Revoked"
    collector.revoked_at = now
    collector.previous_key_hash = None
    collector.previous_key_expires_at = None
    collector.updated_at = now
    db.flush()

    org_id = resolve_audit_organization_id(db, user_id) or collector.organization_id
    create_audit_log(
        db=db,
        organization_id=org_id,
        user_id=user_id,
        action="COLLECTOR_REVOKED",
        resource_type="INTEGRATION",
        resource_id=str(collector.id),
        description=f"Collector '{collector.name}' permanently revoked.",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return collector
