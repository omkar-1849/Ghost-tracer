from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ScanRequest(BaseModel):
    website_id: int
    engine: str = "nmap"


class ScanResponse(BaseModel):
    id: int
    website_id: int
    engine: str
    target: str
    status: str

    findings: int
    risk_score: int

    command: str | None = None
    raw_output: str | None = None
    parsed_output: dict[str, Any] | None = None
    truncated: bool = False

    error: str | None = None

    started_at: datetime
    completed_at: datetime | None = None

    worker_id: str | None = None
    heartbeat_at: datetime | None = None
    version: int = 0

    model_config = ConfigDict(from_attributes=True)