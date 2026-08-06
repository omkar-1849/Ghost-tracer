from datetime import datetime
from typing import Any, Dict, Literal

from pydantic import BaseModel, ConfigDict


class EventCreate(BaseModel):
    event_type: str
    severity: Literal[
        "Info",
        "Low",
        "Medium",
        "High",
        "Critical",
    ] = "Info"
    source: str
    title: str
    description: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    event_metadata: Dict[str, Any] | None = None


class EventResponse(BaseModel):
    id: int
    website_id: int
    integration_id: int
    event_type: str
    severity: str
    source: str
    title: str
    description: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    event_metadata: Dict[str, Any] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)