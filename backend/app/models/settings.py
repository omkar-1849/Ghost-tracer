from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float
from datetime import datetime, timedelta

from app.database.base import Base


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)

    # General
    organization_name = Column(String(255), default="Acme Corp")
    platform_name = Column(String(255), default="Sentinel AI")
    timezone = Column(String(50), default="UTC")
    region = Column(String(100), default="us-east-1")

    # Scanner
    sqlmap_path = Column(String(255), default="/usr/bin/sqlmap")
    default_scanner = Column(String(50), default="sqlmap")
    scan_timeout = Column(Integer, default=120)
    concurrent_scans = Column(Integer, default=5)
    request_delay = Column(Integer, default=0)
    retry_count = Column(Integer, default=3)
    proxy = Column(String(255), default="")
    random_user_agent = Column(Boolean, default=True)
    follow_redirects = Column(Boolean, default=True)
    max_crawl_depth = Column(Integer, default=3)
    risk_level = Column(String(50), default="1")

    # AI
    ai_enabled = Column(Boolean, default=True)
    ai_provider = Column(String(50), default="openai")
    ai_model = Column(String(50), default="gpt-4o")
    api_key = Column(String(255), default="sk-••••••••••••••••••••••••")
    temperature = Column(Float, default=0.2)
    context_length = Column(Integer, default=128000)
    confidence_threshold = Column(Float, default=0.7)
    auto_summary = Column(Boolean, default=True)
    auto_remediation = Column(Boolean, default=False)

    # Security
    session_timeout = Column(Integer, default=30)
    audit_logging = Column(Boolean, default=True)

    # Notifications
    email_notifications = Column(Boolean, default=True)
    desktop_notifications = Column(Boolean, default=False)

    # Metadata
    created_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30),
        onupdate=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )
