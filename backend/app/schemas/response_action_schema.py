from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


class ResponseActionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action_type: Literal["BLOCK_IP"]
    target: str = Field(min_length=1, max_length=50)
    reason: str | None = Field(None, max_length=2000)


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