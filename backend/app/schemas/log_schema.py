from pydantic import BaseModel


class LogCreate(BaseModel):
    ip_address: str
    method: str
    url: str
    status_code: int
    user_agent: str
    message: str


class LogResponse(LogCreate):
    id: int
    risk_score: int
    threat_level: str
    detection_reason: str | None = None

    class Config:
        from_attributes = True