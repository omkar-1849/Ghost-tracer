from pydantic import BaseModel
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


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdateStatus(BaseModel):
    status: str


class IncidentResponse(IncidentBase):
    id: int
    incident_code: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True