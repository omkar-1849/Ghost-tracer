from datetime import datetime
from ipaddress import ip_address
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.incident import Incident
from app.models.response_action import ResponseAction
from app.services.incident_timeline_service import create_timeline_event
from app.services.audit_log_service import create_audit_log
from app.services.response_policy_service import validate_response_action
from app.utils.authorization import scoped_get


def _validate(db, incident_id, action_type, target, ctx):
    if ctx is None or ctx.role not in {"owner", "admin", "analyst"}:
        raise HTTPException(status_code=403, detail="An authorized analyst must approve response simulations.")
    incident = scoped_get(db, Incident, incident_id, ctx)
    # Only BLOCK_IP has a trustworthy incident evidence binding in this model.
    if action_type != "BLOCK_IP":
        raise HTTPException(status_code=400, detail="Only BLOCK_IP simulations are supported.")
    try:
        if ip_address(target) != ip_address(incident.source_ip):
            raise ValueError("target mismatch")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Target must match the incident source IP.")
    confidence = float(incident.confidence or 0) / 100.0
    policy = validate_response_action(action_type, target, confidence, (incident.threat_level or "").upper())
    if not policy.get("allowed"):
        raise HTTPException(status_code=400, detail=policy.get("reason", "Response policy denied this simulation."))
    return incident


def create_response_action(db: Session, incident_id: int, action_type: str, target: str, reason: str | None = None, *, ctx=None):
    _validate(db, incident_id, action_type, target, ctx)
    action = ResponseAction(organization_id=ctx.organization_id, incident_id=incident_id, action_type=action_type, target=target, status="PENDING", reason=reason)
    db.add(action)
    db.flush()
    create_timeline_event(db, incident_id, "Response Simulation Created", f"{ctx.user.email} approved a {action_type} simulation for {target}.")
    create_audit_log(db, ctx.organization_id, "CREATE_RESPONSE_ACTION", user_id=ctx.user.id,
                     resource_type="RESPONSE_ACTION", resource_id=str(action.id), description="Simulation approved; no enforcement performed.")
    return action


def execute_response_action(db: Session, action_id: int, *, ctx=None):
    if ctx is None:
        raise HTTPException(status_code=403, detail="Tenant context required.")
    action = scoped_get(db, ResponseAction, action_id, ctx)
    _validate(db, action.incident_id, action.action_type, action.target, ctx)
    if action.status != "PENDING":
        raise HTTPException(status_code=409, detail="Only pending simulations can be run.")
    action.status = "SIMULATED"
    action.result = f"Simulation only: {action.action_type} for {action.target}. No external enforcement occurred."
    action.executed_at = datetime.utcnow()
    db.flush()
    create_timeline_event(db, action.incident_id, "Response Action Simulated", action.result)
    create_audit_log(db, ctx.organization_id, "SIMULATE_RESPONSE_ACTION", user_id=ctx.user.id,
                     resource_type="RESPONSE_ACTION", resource_id=str(action.id), description=action.result)
    return action


def get_response_actions(db: Session, incident_id: int | None = None, *, organization_id: int, limit: int = 100, offset: int = 0):
    query = (db.query(ResponseAction).join(Incident, Incident.id == ResponseAction.incident_id)
             .filter(ResponseAction.organization_id == organization_id, Incident.organization_id == organization_id))
    if incident_id is not None:
        query = query.filter(ResponseAction.incident_id == incident_id)
    return query.order_by(ResponseAction.created_at.desc()).offset(offset).limit(limit).all()
