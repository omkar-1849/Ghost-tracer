from typing import Any

from pydantic import BaseModel


class ScanRequest(BaseModel):
    engine: str = "sqlmap"
    target: str


class ScanResponse(BaseModel):
    id: int
    target: str
    scanner: str
    status: str
    findings: str
    report: dict[str, Any] | None = None

    class Config:
        from_attributes = True