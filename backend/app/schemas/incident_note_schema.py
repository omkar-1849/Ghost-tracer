from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class IncidentNoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    analyst: str | None = None  # ignored; actor always comes from authentication
    note: str = Field(min_length=1, max_length=10000)


class IncidentNoteResponse(BaseModel):
    id: int
    incident_id: int
    analyst: str
    note: str
    created_at: datetime

    class Config:
        from_attributes = True