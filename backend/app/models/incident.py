from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timedelta

from app.database.base import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)

    incident_code = Column(String(30), unique=True, index=True)

    title = Column(String(255))
    description = Column(String(500))

    threat_level = Column(String(20))
    priority = Column(String(10))
    status = Column(String(30))

    source_ip = Column(String(50))
    target = Column(String(255))

    confidence = Column(Integer)

    assigned_to = Column(String(100), nullable=True)
    assigned_at = Column(DateTime, nullable=True)

    created_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )

    updated_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30),
        onupdate=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )

    resolved_at = Column(DateTime, nullable=True)