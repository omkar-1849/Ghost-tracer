import re
from datetime import datetime
from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class CollectorEnrollRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, max_length=100)
    kind: Literal["daemon", "nginx", "sdk", "legacy"] = "daemon"
    version: Optional[str] = Field(default=None, max_length=50)
    hostname: Optional[str] = Field(default=None, max_length=255)


class CollectorEnrollResponse(BaseModel):
    collector_id: int
    api_key: str
    asset_name: str
    heartbeat_interval_seconds: int
    batch_limits: Dict[str, Any]


class CollectorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    website_id: int
    name: str
    kind: str
    status: str
    version: Optional[str] = None
    hostname: Optional[str] = None
    last_heartbeat_at: Optional[datetime] = None
    last_used: Optional[datetime] = None
    last_seen_ip: Optional[str] = None
    key_prefix: Optional[str] = None
    created_at: datetime
    revoked_at: Optional[datetime] = None


class RotateKeyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grace_seconds: int = Field(default=900, ge=0, le=3600)


class RotateKeyResponse(BaseModel):
    api_key: str
    message: str


class CollectorHeartbeatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    version: Optional[str] = Field(default=None, max_length=50)
    hostname: Optional[str] = Field(default=None, max_length=255)

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not re.match(r"^[a-zA-Z0-9.\-_/+]+$", v):
                raise ValueError("version contains invalid characters")
        return v

    @field_validator("hostname")
    @classmethod
    def validate_hostname(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not re.match(r"^[a-zA-Z0-9.\-_]+$", v):
                raise ValueError("hostname contains invalid characters")
        return v


class CollectorHeartbeatResponse(BaseModel):
    server_time: str
    heartbeat_interval_seconds: int
    batch_limits: Dict[str, Any]
