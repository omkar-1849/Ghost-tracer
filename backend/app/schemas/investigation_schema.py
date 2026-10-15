from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class InvestigationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    website_id: int
    trigger_scan_id: int | None = None
    status: str
    title: str | None = None
    summary: str | None = None
    risk_level: str | None = None
    confidence: float | None = None
    evidence_status: str | None = None
    evidence_bundle: Any | None = None
    report: Any | None = None
    generated_by: str | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
