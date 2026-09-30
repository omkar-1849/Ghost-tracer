from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.api_key_auth import verify_api_key
from app.schemas.event_schema import EventCreate, EventResponse
from app.services.event_service import (
    create_event,
    get_event,
    get_events,
)
from app.utils.authorization import get_tenant_context, scoped_get
from app.models.website import Website

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
    # Ingestion is integration-scoped: organization context was set from the
    # trusted Integration row (never from caller claims) by the middleware.
    return create_event(db, integration, event)


@router.get("", response_model=list[EventResponse])
@router.get("/", response_model=list[EventResponse], include_in_schema=False)
def list_events(
    website_id: int = Query(...),
    context=Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    scoped_get(db, Website, website_id, context)
    return get_events(db, website_id)


@router.get("/{website_id}", response_model=list[EventResponse])
def list_website_events(website_id: int, context=Depends(get_tenant_context), db: Session = Depends(get_db)):
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
