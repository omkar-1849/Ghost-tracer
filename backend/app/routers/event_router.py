from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.api_key_auth import verify_api_key
from app.schemas.event_schema import EventCreate, EventResponse
from app.services.event_service import (
    create_event,
    get_event,
    get_events,
)

router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


@router.post("/", response_model=EventResponse)
def ingest_event(
    event: EventCreate,
    integration=Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    return create_event(db, integration, event)


@router.get("/{website_id}", response_model=list[EventResponse])
def list_events(
    website_id: int,
    db: Session = Depends(get_db),
):
    return get_events(db, website_id)


@router.get("/detail/{event_id}", response_model=EventResponse)
def event_details(
    event_id: int,
    db: Session = Depends(get_db),
):
    return get_event(db, event_id)