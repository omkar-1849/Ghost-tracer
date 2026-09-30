from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.services.normalization_service import normalize_ip, normalize_url, normalize_method, safe_text


class LogCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)
    ip_address: str = Field(min_length=1, max_length=50)
    method: str = Field(min_length=1, max_length=10)
    url: str = Field(min_length=1, max_length=255)
    status_code: int = Field(ge=100, le=599)
    user_agent: str = Field(max_length=255)
    message: str = Field(max_length=255)

    @field_validator("ip_address", "method", "url")
    @classmethod
    def canonical_fields(cls, value, info):
        result = {"ip_address": normalize_ip, "method": normalize_method, "url": normalize_url}[info.field_name](value)
        if result is None:
            raise ValueError("Invalid request field")
        return result

    @field_validator("user_agent", "message")
    @classmethod
    def plain_text(cls, value):
        if value and safe_text(value, 255) is None:
            raise ValueError("Invalid text")
        return value


class LogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    website_id: int | None = None
    ip_address: str | None = None
    method: str | None = None
    url: str | None = None
    status_code: int | None = None
    user_agent: str | None = None
    message: str | None = None
    risk_score: int
    threat_level: str
    detection_reason: str | None = None
    timestamp: datetime | None = None
