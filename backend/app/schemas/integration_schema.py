from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class IntegrationCreate(BaseModel):
    pass


class IntegrationResponse(BaseModel):
    id: int
    website_id: int
    name: str | None = None
    kind: str = "legacy"
    status: Literal["Connected", "Revoked", "Disabled"]
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    last_used: datetime | None = None

    model_config = ConfigDict(from_attributes=True)



class IntegrationKeyResponse(BaseModel):
    api_key: str
    api_secret: str


class RegenerateResponse(BaseModel):
    message: str
    api_key: str
    api_secret: str