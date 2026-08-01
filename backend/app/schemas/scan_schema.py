from pydantic import BaseModel


class ScanRequest(BaseModel):
    target: str


class ScanResponse(BaseModel):
    id: int
    target: str
    scanner: str
    status: str
    findings: str

    class Config:
        from_attributes = True