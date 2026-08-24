from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.response_action_schema import (
    ResponseActionCreate,
    ResponseActionResponse,
)
from app.services.response_action_service import (
    create_response_action,
    execute_response_action,
    get_response_actions,
)

router = APIRouter(
    prefix="/response-actions",
    tags=["Response Actions"],
)


@router.post(
    "/",
    response_model=ResponseActionResponse,
)
def create_action(
    action: ResponseActionCreate,
    incident_id: int,
    db: Session = Depends(get_db),
):
    return create_response_action(
        db=db,
        incident_id=incident_id,
        action_type=action.action_type,
        target=action.target,
        reason=action.reason,
    )


@router.post(
    "/{action_id}/execute",
    response_model=ResponseActionResponse,
)
def execute_action(
    action_id: int,
    db: Session = Depends(get_db),
):
    result = execute_response_action(
        db=db,
        action_id=action_id,
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Response action not found.",
        )

    return result


@router.get(
    "/incident/{incident_id}",
    response_model=list[ResponseActionResponse],
)
def list_actions(
    incident_id: int,
    db: Session = Depends(get_db),
):
    return get_response_actions(
        db=db,
        incident_id=incident_id,
    )