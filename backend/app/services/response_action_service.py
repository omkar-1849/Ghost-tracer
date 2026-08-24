from datetime import datetime

from sqlalchemy.orm import Session

from app.models.response_action import ResponseAction
from app.services.incident_timeline_service import create_timeline_event


def create_response_action(
    db: Session,
    incident_id: int,
    action_type: str,
    target: str,
    reason: str | None = None,
):
    action = ResponseAction(
        incident_id=incident_id,
        action_type=action_type,
        target=target,
        status="PENDING",
        reason=reason,
    )

    db.add(action)
    db.commit()
    db.refresh(action)

    create_timeline_event(
        db=db,
        incident_id=incident_id,
        event="Response Action Created",
        description=(
            f"Response action '{action_type}' created "
            f"for target '{target}'."
        ),
    )

    return action


def execute_response_action(
    db: Session,
    action_id: int,
):
    action = (
        db.query(ResponseAction)
        .filter(ResponseAction.id == action_id)
        .first()
    )

    if not action:
        return None

    # Safe simulation for now.
    action.status = "EXECUTED"
    action.result = (
        f"Simulated execution of {action.action_type} "
        f"against {action.target}."
    )
    action.executed_at = datetime.utcnow()

    db.commit()
    db.refresh(action)

    create_timeline_event(
        db=db,
        incident_id=action.incident_id,
        event="Response Action Executed",
        description=(
            f"Response action '{action.action_type}' "
            f"executed against '{action.target}'."
        ),
    )

    return action


def get_response_actions(
    db: Session,
    incident_id: int,
):
    return (
        db.query(ResponseAction)
        .filter(ResponseAction.incident_id == incident_id)
        .order_by(ResponseAction.created_at.desc())
        .all()
    )