from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.api_key_auth import verify_api_key
from app.models.audit_log import AuditLog
from app.schemas.batch_schema import BatchItemResult, BatchResponse, LogBatchCreate
from app.schemas.log_schema import LogCreate, LogResponse
from app.services.log_service import create_log, get_recent_logs
from app.utils.authorization import get_tenant_context
from app.utils.body_guard import parse_telemetry_body
from app.utils.rate_limiter import consume_telemetry_budget

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.post("", response_model=LogResponse, status_code=201)
@router.post("/", response_model=LogResponse, status_code=201, include_in_schema=False)
def add_log(
    log: LogCreate,
    integration=Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    # Check rate limit budget per collector
    retry_after = consume_telemetry_budget(integration.id, 1)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Telemetry rate limit exceeded",
            headers={"Retry-After": str(retry_after)},
        )

    # Log ingestion requires an integration-scoped API key; organization comes
    # from the trusted Integration row, website is the integration's website.
    return create_log(db, log, website_id=integration.website_id, integration_id=integration.id)


@router.post("/batch", response_model=BatchResponse, status_code=200)
async def add_log_batch(
    request: Request,
    integration=Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    # 1. Parse and guard request body (gzip, max size, json bomb protection)
    data = await parse_telemetry_body(request)

    # 2. Validate envelope schema (extra="forbid", item count limits)
    try:
        envelope = LogBatchCreate.model_validate(data)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid batch envelope: {exc.errors()[:1]}",
        )

    # 3. Check rate limit budget for the batch size
    item_count = len(envelope.items)
    retry_after = consume_telemetry_budget(integration.id, item_count)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Telemetry rate limit exceeded",
            headers={"Retry-After": str(retry_after)},
        )

    # 4. Process items in order with savepoint isolation
    results: list[BatchItemResult] = []
    accepted = 0
    rejected = 0

    for idx, raw_item in enumerate(envelope.items):
        sp = db.begin_nested()
        try:
            validated_log = LogCreate.model_validate(raw_item)
            db_log = create_log(
                db,
                validated_log,
                website_id=integration.website_id,
                integration_id=integration.id,
                audit=False,
            )
            sp.commit()
            accepted += 1
            results.append(BatchItemResult(index=idx, status="accepted", id=db_log.id))
        except Exception as exc:
            sp.rollback()
            rejected += 1
            if isinstance(exc, ValidationError):
                error_msg = "Validation failed: " + "; ".join(
                    f"{err['loc']}: {err['msg']}" for err in exc.errors()
                )[:200]
            else:
                error_msg = "Processing failed"
            results.append(BatchItemResult(index=idx, status="rejected", error=error_msg))

    # 5. One summary audit row per batch
    db.add(
        AuditLog(
            organization_id=integration.organization_id,
            action="INGEST_LOG_BATCH",
            resource_type="LOG_BATCH",
            resource_id=str(integration.id),
            description=f"Batch processed: {accepted} accepted, {rejected} rejected.",
        )
    )
    db.commit()

    return BatchResponse(accepted=accepted, duplicates=0, rejected=rejected, results=results)


@router.get("/recent", response_model=list[LogResponse])
def recent_logs(
    limit: int = Query(default=10, ge=1, le=100),
    context=Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    # Reads are JWT authenticated and tenant scoped.
    return get_recent_logs(db, organization_id=context.organization_id, limit=limit)
