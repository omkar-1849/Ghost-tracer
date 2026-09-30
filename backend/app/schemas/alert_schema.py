from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    website_id: int | None = None
    event_id: int | None = None
    log_id: int | None = None
    ip_address: str | None = None
    threat_level: str
    message: str
    created_at: datetime
