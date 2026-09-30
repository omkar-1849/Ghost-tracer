from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.middleware.api_key_auth import verify_api_key
from app.schemas.log_schema import LogCreate, LogResponse
from app.services.log_service import create_log, get_recent_logs
from app.utils.authorization import get_tenant_context

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.post("", response_model=LogResponse, status_code=201)
@router.post("/", response_model=LogResponse, status_code=201, include_in_schema=False)
def add_log(
    log: LogCreate,
    integration=Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    # Log ingestion requires an integration-scoped API key; organization comes
    # from the trusted Integration row, website is the integration's website.
    return create_log(db, log, website_id=integration.website_id)


@router.get("/recent", response_model=list[LogResponse])
def recent_logs(
    limit: int = Query(default=10, ge=1, le=100),
    context=Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    # Reads are JWT authenticated and tenant scoped.
    return get_recent_logs(db, limit=limit)
