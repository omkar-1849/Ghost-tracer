from datetime import datetime
import json
import math
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def bounded_metadata(value):
    """Only bounded JSON values are accepted; never stringify arbitrary objects."""
    if value is None:
        return {}
    if type(value) is not dict:
        raise ValueError("Metadata must be an object")
    nodes = 0

    def visit(item, depth=0):
        nonlocal nodes
        nodes += 1
        if nodes > 1024 or depth > 6:
            raise ValueError("Metadata exceeds structural limits")
        if type(item) is dict:
            if len(item) > 64:
                raise ValueError("Too many metadata keys")
            for key, child in item.items():
                if type(key) is not str or not 1 <= len(key) <= 100:
                    raise ValueError("Invalid metadata key")
                visit(child, depth + 1)
        elif type(item) is list:
            if len(item) > 128:
                raise ValueError("Metadata list too long")
            for child in item:
                visit(child, depth + 1)
        elif type(item) is str:
            if len(item) > 4096:
                raise ValueError("Metadata string too long")
        elif type(item) in (int, float):
            if abs(item) > 2**53 or not math.isfinite(item):
                raise ValueError("Invalid metadata number")
        elif item is not None and type(item) is not bool:
            raise ValueError("Metadata must contain JSON values")

    visit(value)
    if len(json.dumps(value, ensure_ascii=True, allow_nan=False).encode()) > 16384:
        raise ValueError("Metadata exceeds 16 KiB")
    return value


class EventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)
    event_type: str = Field(min_length=1, max_length=100)
    severity: Literal["Info", "Low", "Medium", "High", "Critical"] = "Info"
    source: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4096)
    ip_address: str | None = Field(default=None, max_length=50)
    user_agent: str | None = Field(default=None, max_length=500)
    event_metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def metadata_alias(cls, data):
        if isinstance(data, dict) and "metadata" in data:
            data = dict(data)
            alias = data.pop("metadata")
            if "event_metadata" in data and data["event_metadata"] != alias:
                raise ValueError("metadata and event_metadata disagree")
            data["event_metadata"] = alias
        return data

    _metadata_bounds = field_validator("event_metadata", mode="before")(bounded_metadata)


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
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
    event_metadata: dict[str, Any] | None = None
    created_at: datetime
    fingerprint: str | None = None
    risk_score: int | None = None
    threat_level: str | None = None
    detection_result: dict[str, Any] | None = None
    analyst_result: dict[str, Any] | None = None
    normalization_version: int | None = None
    processed_at: datetime | None = None


class CanonicalSecurityEvent(BaseModel):
    event_id: str | None = None
    timestamp: datetime
    source: str
    source_type: str
    event_type: str
    severity: Literal["Info", "Low", "Medium", "High", "Critical"]
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
    metadata: dict[str, Any] = Field(default_factory=dict)
