from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SettingsBase(BaseModel):
    organization_name: str = "Acme Corp"
    platform_name: str = "Sentinel AI"
    timezone: str = "UTC"
    region: str = "us-east-1"

    sqlmap_path: str = "/usr/bin/sqlmap"
    default_scanner: str = "sqlmap"
    scan_timeout: int = Field(120, ge=10, le=3600)
    concurrent_scans: int = Field(5, ge=1, le=50)
    request_delay: int = Field(0, ge=0, le=60)
    retry_count: int = Field(3, ge=0, le=10)
    proxy: str = ""
    random_user_agent: bool = True
    follow_redirects: bool = True
    max_crawl_depth: int = Field(3, ge=1, le=10)
    risk_level: str = "1"

    ai_enabled: bool = True
    ai_provider: str = "openai"
    ai_model: str = "gpt-4o"
    api_key: str = "sk-••••••••••••••••••••••••"
    temperature: float = Field(0.2, ge=0.0, le=2.0)
    context_length: int = Field(128000, ge=1024, le=1000000)
    confidence_threshold: float = Field(0.7, ge=0.0, le=1.0)
    auto_summary: bool = True
    auto_remediation: bool = True

    session_timeout: int = Field(30, ge=5, le=1440)
    audit_logging: bool = True

    email_notifications: bool = True
    desktop_notifications: bool = True


class SettingsUpdate(BaseModel):
    organization_name: Optional[str] = None
    platform_name: Optional[str] = None
    timezone: Optional[str] = None
    region: Optional[str] = None

    sqlmap_path: Optional[str] = None
    default_scanner: Optional[str] = None
    scan_timeout: Optional[int] = Field(None, ge=10, le=3600)
    concurrent_scans: Optional[int] = Field(None, ge=1, le=50)
    request_delay: Optional[int] = Field(None, ge=0, le=60)
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    proxy: Optional[str] = None
    random_user_agent: Optional[bool] = None
    follow_redirects: Optional[bool] = None
    max_crawl_depth: Optional[int] = Field(None, ge=1, le=10)
    risk_level: Optional[str] = None

    ai_enabled: Optional[bool] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    api_key: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    context_length: Optional[int] = Field(None, ge=1024, le=1000000)
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    auto_summary: Optional[bool] = None
    auto_remediation: Optional[bool] = None

    session_timeout: Optional[int] = Field(None, ge=5, le=1440)
    audit_logging: Optional[bool] = None

    email_notifications: Optional[bool] = None
    desktop_notifications: Optional[bool] = None


class SettingsResponse(SettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
