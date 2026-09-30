from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.incident import Incident
from app.models.response_action import ResponseAction
from app.schemas.response_action_schema import ResponseActionCreate, ResponseActionResponse
from app.services.response_action_service import create_response_action, execute_response_action, get_response_actions
from app.utils.authorization import TenantContext, get_tenant_context, require_roles, scoped_get

router = APIRouter(prefix="/response-actions", tags=["Response Actions"])


@router.post("/", response_model=ResponseActionResponse)
def create_action(action: ResponseActionCreate, incident_id: int, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin", "analyst"))):
    scoped_get(db, Incident, incident_id, ctx)
    return create_response_action(db, incident_id, action.action_type, action.target, action.reason, ctx=ctx)


@router.post("/{action_id}/execute", response_model=ResponseActionResponse)
def execute_action(action_id: int, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin", "analyst"))):
    action = scoped_get(db, ResponseAction, action_id, ctx)
    scoped_get(db, Incident, action.incident_id, ctx)
    return execute_response_action(db, action_id, ctx=ctx)


@router.get("/", response_model=list[ResponseActionResponse])
@router.get("", response_model=list[ResponseActionResponse], include_in_schema=False)
def list_all_actions(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_response_actions(db, organization_id=ctx.organization_id, limit=limit, offset=offset)


@router.get("/incident/{incident_id}", response_model=list[ResponseActionResponse])
def list_actions(incident_id: int, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    scoped_get(db, Incident, incident_id, ctx)
    return get_response_actions(db, incident_id, organization_id=ctx.organization_id)
