from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict


class ScannerFindingObservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    finding_id: int
    scan_id: int
    engine: str
    scanner_rule_id: str | None = None
    raw_severity: str | None = None
    confidence: float
    evidence_data: Any | None = None
    observed_at: datetime


class ScannerFindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    website_id: int
    scan_id: int | None = None
    fingerprint: str
    engine: str
    category: str
    title: str
    description: str | None = None
    severity: str
    severity_basis: str | None = None
    confidence: float
    affected_asset: Any | None = None
    cwe: Any | None = None
    cve: Any | None = None
    status: str
    first_seen_at: datetime
    last_seen_at: datetime
    seen_count: int
    first_seen_scan_id: int | None = None
    last_seen_scan_id: int | None = None
    created_at: datetime
    updated_at: datetime


class ScannerFindingDetailResponse(ScannerFindingResponse):
    observations: list[ScannerFindingObservationResponse] = []


class ScannerFindingStatusUpdate(BaseModel):
    status: Literal["open", "acknowledged", "resolved", "false_positive", "accepted_risk"]
