from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: int
    organization_id: int
    user_id: Optional[int] = None

    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None

    description: Optional[str] = None

    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)