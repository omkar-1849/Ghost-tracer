from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    expires_at: datetime
    last_used_at: datetime
    revoked: bool