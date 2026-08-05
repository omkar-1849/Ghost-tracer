from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from datetime import datetime, timedelta

from app.database.base import Base


class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, index=True)

    target = Column(String(255))

    scanner = Column(String(50))

    status = Column(String(50), default="QUEUED")

    findings = Column(Text)

    # Structured enterprise report
    report = Column(JSON, nullable=True)

    created_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )

    completed_at = Column(DateTime, nullable=True)