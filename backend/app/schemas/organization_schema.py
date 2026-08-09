from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrganizationCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=255,
    )


class OrganizationUpdate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=255,
    )


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    created_at: datetime
    updated_at: datetime


class MemberCreate(BaseModel):
    email: str
    role: str = "viewer"


class MemberResponse(BaseModel):
    id: int
    user_id: int
    email: str
    full_name: str | None
    role: str
    created_at: datetime


class RoleUpdate(BaseModel):
    role: str