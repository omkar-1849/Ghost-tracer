import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session

from sqlalchemy.exc import IntegrityError, OperationalError

logger = logging.getLogger("sentinel.events")
from app.database.database import get_db
from app.middleware.api_key_auth import verify_api_key
from app.models.audit_log import AuditLog
from app.models.website import Website
from app.schemas.batch_schema import BatchItemResult, BatchResponse, EventBatchCreate
from app.schemas.event_schema import EventCreate, EventResponse
from app.services.event_service import (
    create_event,
    get_event,
    get_events,
)
from app.utils.authorization import get_tenant_context, scoped_get
from app.utils.body_guard import parse_telemetry_body
from app.utils.rate_limiter import consume_telemetry_budget

router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


@router.post("", response_model=EventResponse, status_code=201)
@router.post("/", response_model=EventResponse, status_code=201)
def ingest_event(
    event: EventCreate,
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

    # Ingestion is integration-scoped: organization context was set from the
    # trusted Integration row (never from caller claims) by the middleware.
    try:
        created = create_event(db, integration, event)
    except OperationalError as exc:
        if "locked" in str(exc).lower() or "deadlock" in str(exc).lower():
            raise HTTPException(
                status_code=503,
                detail="Database temporarily busy; please retry",
                headers={"Retry-After": "1"},
            )
        raise

    if getattr(created, "ai_status", None) == "PENDING":
        try:
            from app.services.ai_worker import wake_ai_worker
            wake_ai_worker()
        except Exception:
            pass

    return created


@router.post("/batch", response_model=BatchResponse, status_code=200)
async def ingest_event_batch(
    request: Request,
    integration=Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    # 1. Parse and guard request body (gzip, max size, json bomb protection)
    data = await parse_telemetry_body(request)

    # 2. Validate envelope schema (extra="forbid", item count limits)
    try:
        envelope = EventBatchCreate.model_validate(data)
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
    duplicates = 0
    rejected = 0
    has_pending_ai = False

    for idx, raw_item in enumerate(envelope.items):
        sp = db.begin_nested()
        try:
            validated_event = EventCreate.model_validate(raw_item)
            event_res = create_event(
                db,
                integration,
                validated_event,
                audit=False,
            )
            sp.commit()
            if getattr(event_res, "_is_duplicate", False):
                duplicates += 1
                dup_kind = getattr(event_res, "_duplicate_kind", "suppressed")
                ev_id = getattr(event_res, "_event_id", None)
                results.append(
                    BatchItemResult(
                        index=idx,
                        status="duplicate",
                        id=event_res.id,
                        duplicate_kind=dup_kind,
                        event_id=ev_id,
                    )
                )
            else:
                accepted += 1
                ev_id = getattr(event_res, "client_event_id", None)
                if getattr(event_res, "ai_status", None) == "PENDING":
                    has_pending_ai = True
                results.append(
                    BatchItemResult(
                        index=idx,
                        status="accepted",
                        id=event_res.id,
                        event_id=ev_id,
                    )
                )
        except IntegrityError:
            sp.rollback()
            ev_id = None
            if "validated_event" in locals() and getattr(validated_event, "event_id", None):
                ev_id = validated_event.event_id
                from app.models.event import Event
                existing = db.query(Event).filter(
                    Event.organization_id == integration.organization_id,
                    Event.integration_id == integration.id,
                    Event.client_event_id == ev_id,
                ).first()
                if existing is not None:
                    duplicates += 1
                    results.append(
                        BatchItemResult(
                            index=idx,
                            status="duplicate",
                            id=existing.id,
                            duplicate_kind="replay",
                            event_id=ev_id,
                        )
                    )
                    continue
            rejected += 1
            results.append(
                BatchItemResult(
                    index=idx,
                    status="rejected",
                    error="Integrity constraint violation",
                    code="INTEGRITY_ERROR",
                    retryable=False,
                )
            )
        except Exception as exc:
            sp.rollback()
            logger.exception("Batch item %d failed: %s", idx, exc)
            if isinstance(exc, OperationalError) and ("locked" in str(exc).lower() or "deadlock" in str(exc).lower()):
                raise HTTPException(
                    status_code=503,
                    detail="Database temporarily busy; please retry",
                    headers={"Retry-After": "1"},
                )
            rejected += 1
            if isinstance(exc, ValidationError):
                error_msg = "Validation failed: " + "; ".join(
                    f"{err['loc']}: {err['msg']}" for err in exc.errors()
                )[:200]
                code = "VALIDATION_ERROR"
            else:
                error_msg = "Processing failed"
                code = "PROCESSING_ERROR"
            results.append(
                BatchItemResult(
                    index=idx,
                    status="rejected",
                    error=error_msg,
                    code=code,
                    retryable=False,
                )
            )

    # 5. One summary audit row per batch
    db.add(
        AuditLog(
            organization_id=integration.organization_id,
            action="INGEST_EVENT_BATCH",
            resource_type="EVENT_BATCH",
            resource_id=str(integration.id),
            description=f"Batch processed: {accepted} accepted, {duplicates} duplicate, {rejected} rejected.",
        )
    )
    try:
        db.commit()
    except OperationalError as exc:
        db.rollback()
        if "locked" in str(exc).lower() or "deadlock" in str(exc).lower():
            raise HTTPException(
                status_code=503,
                detail="Database temporarily busy; please retry",
                headers={"Retry-After": "1"},
            )
        raise

    if has_pending_ai:
        try:
            from app.services.ai_worker import wake_ai_worker
            wake_ai_worker()
        except Exception:
            pass

    return BatchResponse(
        accepted=accepted, duplicates=duplicates, rejected=rejected, results=results
    )


@router.get("", response_model=list[EventResponse])
@router.get("/", response_model=list[EventResponse], include_in_schema=False)
def list_events(
    website_id: int | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    context=Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    if website_id is not None:
        scoped_get(db, Website, website_id, context)
    return get_events(db, website_id=website_id, limit=limit)



@router.get("/{website_id}", response_model=list[EventResponse])
def list_website_events(
    website_id: int, context=Depends(get_tenant_context), db: Session = Depends(get_db)
):
    scoped_get(db, Website, website_id, context)
    return get_events(db, website_id)


@router.get("/detail/{event_id}", response_model=EventResponse)
def event_details(
    event_id: int,
    context=Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    event = get_event(db, event_id)
    if event is None or event.organization_id != context.organization_id:
        raise HTTPException(404, "Resource not found.")
    return event
