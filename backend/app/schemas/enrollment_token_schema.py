from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class EnrollmentTokenCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    label: str | None = Field(default=None, max_length=100)
    expires_in_hours: int = Field(default=1, ge=1, le=168)
    max_uses: int = Field(default=1, ge=1, le=50)


class EnrollmentTokenCreateResponse(BaseModel):
    id: int
    token: str
    token_prefix: str
    expires_at: datetime
    max_uses: int
    website_id: int | None = None


class EnrollmentTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    website_id: int | None = None
    label: str | None = None
    token_prefix: str
    expires_at: datetime
    max_uses: int
    used_count: int
    status: str
    created_by_user_id: int | None = None
    created_at: datetime
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None


class EnrollmentTokenStatusResponse(BaseModel):
    id: int
    token_prefix: str
    status: str
    expires_at: datetime
    max_uses: int
    used_count: int
    website_id: int | None = None
    website: dict | None = None
    collector: dict | None = None

