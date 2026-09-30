from pydantic import BaseModel, ConfigDict, Field
from typing import Literal
from typing import Optional
from datetime import datetime


class IncidentBase(BaseModel):
    title: str
    description: str
    threat_level: str
    priority: str
    status: str
    source_ip: str
    target: str
    confidence: int
    assigned_to: str | None = None

class IncidentCreate(IncidentBase):
    pass


class IncidentUpdateStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["OPEN", "INVESTIGATING", "RESOLVED"]


class IncidentResponse(IncidentBase):
    id: int
    incident_code: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    assigned_to: str | None = None
    assigned_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class IncidentAssign(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assigned_to: str = Field(min_length=1, max_length=100)