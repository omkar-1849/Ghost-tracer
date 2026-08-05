from pydantic import BaseModel
from datetime import datetime


class IncidentNoteCreate(BaseModel):
    analyst: str
    note: str


class IncidentNoteResponse(BaseModel):
    id: int
    incident_id: int
    analyst: str
    note: str
    created_at: datetime

    class Config:
        from_attributes = True