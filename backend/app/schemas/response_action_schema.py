from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ResponseActionCreate(BaseModel):
    action_type: str
    target: str
    reason: str | None = None


class ResponseActionResponse(BaseModel):
    id: int
    incident_id: int
    action_type: str
    target: str
    status: str
    reason: str | None = None
    result: str | None = None
    created_at: datetime
    executed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)