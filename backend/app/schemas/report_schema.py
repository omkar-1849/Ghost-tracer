from pydantic import BaseModel
from typing import Any


class Summary(BaseModel):
    status: str
    risk: str
    target: str | None = None
    engine: str
    started_at: str | None = None
    completed_at: str | None = None
    duration: str | None = None


class Findings(BaseModel):
    waf: str | None = None
    dbms: str | None = None
    injectable: bool
    parameters_tested: int
    http_errors: list[Any]
    warnings: list[str]
    critical: list[str]
    databases: list[str]
    tables: list[str]
    columns: list[str]


class Metadata(BaseModel):
    sqlmap_version: str | None = None
    exit_status: str


class ScanReport(BaseModel):
    summary: Summary
    findings: Findings
    timeline: list[Any]
    recommendations: list[str]
    metadata: Metadata
    raw_output: str