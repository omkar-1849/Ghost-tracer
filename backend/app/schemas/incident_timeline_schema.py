from pydantic import BaseModel
from datetime import datetime


class IncidentTimelineBase(BaseModel):
    incident_id: int
    event: str
    description: str


class IncidentTimelineCreate(IncidentTimelineBase):
    pass


class IncidentTimelineResponse(IncidentTimelineBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True