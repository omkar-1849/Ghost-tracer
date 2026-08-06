from datetime import datetime, timedelta

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database.base import Base


class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)

    website_id = Column(
        Integer,
        ForeignKey("websites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    engine = Column(String(50), nullable=False)        # nmap, nuclei
    status = Column(String(30), default="Pending")     # Pending, Running, Completed, Failed

    started_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30),
    )

    completed_at = Column(DateTime, nullable=True)

    target = Column(String(255), nullable=False)

    command = Column(Text, nullable=True)

    findings = Column(Integer, default=0)
    risk_score = Column(Integer, default=0)

    raw_output = Column(Text, nullable=True)
    parsed_output = Column(JSON, nullable=True)

    error = Column(Text, nullable=True)

    scheduled = Column(Boolean, default=False)

    created_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30),
    )

    updated_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30),
        onupdate=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30),
    )

    website = relationship("Website")