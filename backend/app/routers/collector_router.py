from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config.telemetry import (
    HEARTBEAT_INTERVAL_SECONDS,
    TELEMETRY_BATCH_MAX_BODY_BYTES,
    TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES,
    TELEMETRY_BATCH_MAX_ITEMS,
)
from app.database.database import get_db
from app.middleware.api_key_auth import verify_api_key
from app.schemas.collector_schema import (
    CollectorEnrollRequest,
    CollectorEnrollResponse,
    CollectorHeartbeatRequest,
    CollectorHeartbeatResponse,
)
from app.services.collector_service import enroll_collector
from app.utils.client_ip import get_client_ip
from app.utils.rate_limiter import check_enroll_rate_limit, record_enroll_failure

router = APIRouter(prefix="/collector", tags=["Collector Machine Plane"])


@router.post("/enroll", response_model=CollectorEnrollResponse, status_code=201)
def enroll(
    request: Request,
    body: CollectorEnrollRequest,
    x_enrollment_token: str | None = Header(None, alias="X-Enrollment-Token"),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)

    # Step 1: Check rate limit before database access
    retry_after = check_enroll_rate_limit(client_ip)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Too many failed enrollment attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    if not x_enrollment_token:
        record_enroll_failure(client_ip)
        raise HTTPException(status_code=401, detail="Invalid or expired enrollment token")

    try:
        result = enroll_collector(
            db=db,
            raw_token=x_enrollment_token,
            name=body.name,
            kind=body.kind,
            version=body.version,
            hostname=body.hostname,
            client_ip=client_ip,
        )
        return result
    except HTTPException as exc:
        if exc.status_code == 401:
            record_enroll_failure(client_ip)
        raise


@router.post("/heartbeat", response_model=CollectorHeartbeatResponse)
def heartbeat(
    request: Request,
    body: CollectorHeartbeatRequest,
    integration=Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"

    if body.version is not None:
        integration.version = body.version
    if body.hostname is not None:
        integration.hostname = body.hostname
    integration.last_heartbeat_at = datetime.now(timezone.utc).replace(tzinfo=None)
    integration.last_seen_ip = client_ip
    db.commit()

    return CollectorHeartbeatResponse(
        server_time=datetime.now(timezone.utc).isoformat(),
        heartbeat_interval_seconds=HEARTBEAT_INTERVAL_SECONDS,
        batch_limits={
            "max_items": TELEMETRY_BATCH_MAX_ITEMS,
            "max_body_bytes": TELEMETRY_BATCH_MAX_BODY_BYTES,
            "max_decompressed_bytes": TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES,
        },
    )
