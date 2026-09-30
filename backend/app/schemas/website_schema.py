from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


class WebsiteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., max_length=255)
    description: Optional[str] = None
    environment: str = Field(
        "Production",
        pattern="^(Production|Staging|Development)$"
    )
    status: str = Field(
        "Active",
        pattern="^(Active|Inactive|Archived)$"
    )
    owner: Optional[str] = None
    favicon_url: Optional[str] = None
    monitoring_enabled: bool = True
    tags: Optional[str] = None
    notes: Optional[str] = None
    health_status: str = Field(
        "Unknown",
        pattern="^(Healthy|Warning|Critical|Unknown)$"
    )

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError(
                "URL must start with http:// or https://"
            )
        return v


class WebsiteCreate(WebsiteBase):
    model_config = ConfigDict(extra="forbid")


class WebsiteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    url: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    environment: Optional[str] = Field(
        None,
        pattern="^(Production|Staging|Development)$"
    )
    status: Optional[str] = Field(
        None,
        pattern="^(Active|Inactive|Archived)$"
    )
    owner: Optional[str] = None
    favicon_url: Optional[str] = None
    monitoring_enabled: Optional[bool] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    health_status: Optional[str] = Field(
        None,
        pattern="^(Healthy|Warning|Critical|Unknown)$"
    )

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith(("http://", "https://")):
            raise ValueError(
                "URL must start with http:// or https://"
            )
        return v


class WebsiteResponse(WebsiteBase):
    id: int
    domain: str
    ip_address: Optional[str] = None
    security_score: Optional[int] = None
    last_scan: Optional[datetime] = None

    verified: bool
    verification_method: Optional[str] = None
    verification_token: Optional[str] = None
    verified_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True