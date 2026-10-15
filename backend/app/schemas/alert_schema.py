from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    website_id: int | None = None
    event_id: int | None = None
    log_id: int | None = None
    incident_id: int | None = None
    ip_address: str | None = None
    threat_level: str
    message: str
    created_at: datetime
    source_type: str | None = None
    finding_id: int | None = None
    investigation_id: int | None = None
    scan_id: int | None = None
