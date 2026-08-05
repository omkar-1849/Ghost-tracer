from pydantic import BaseModel
from datetime import datetime


class IncidentEvidenceBase(BaseModel):
    incident_id: int
    filename: str
    file_type: str
    description: str


class IncidentEvidenceCreate(IncidentEvidenceBase):
    pass


class IncidentEvidenceResponse(IncidentEvidenceBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True