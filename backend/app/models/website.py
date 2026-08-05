from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime, timedelta

from app.database.base import Base

class Website(Base):
    __tablename__ = "websites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    url = Column(String(255), unique=True, index=True)
    domain = Column(String(255), index=True)
    ip_address = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    
    environment = Column(String(50), default="Production")
    status = Column(String(50), default="Active")
    security_score = Column(Integer, nullable=True)
    owner = Column(String(255), nullable=True)
    
    favicon_url = Column(String(255), nullable=True)
    monitoring_enabled = Column(Boolean, default=True)
    tags = Column(Text, nullable=True)  # Comma-separated tags
    notes = Column(Text, nullable=True)
    
    health_status = Column(String(50), default="Unknown")
    
    last_scan = Column(DateTime, nullable=True)
    
    created_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30),
        onupdate=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )
    deleted_at = Column(DateTime, nullable=True)
