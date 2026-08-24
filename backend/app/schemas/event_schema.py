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

class CanonicalSecurityEvent(BaseModel):
    event_id: str | None = None
    timestamp: datetime

    source: str
    source_type: str
    event_type: str
    severity: Literal[
        "Info",
        "Low",
        "Medium",
        "High",
        "Critical",
    ]

    src_ip: str | None = None
    dst_ip: str | None = None
    src_port: int | None = None
    dst_port: int | None = None
    protocol: str | None = None

    user: str | None = None
    hostname: str | None = None
    domain: str | None = None

    url: str | None = None
    method: str | None = None
    status_code: int | None = None
    user_agent: str | None = None

    title: str | None = None
    description: str | None = None

    raw_event: Any | None = None
    metadata: Dict[str, Any] = {}