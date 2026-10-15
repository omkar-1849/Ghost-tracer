from datetime import datetime
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Index,
)
from sqlalchemy.orm import relationship

from app.database.base import Base, TenantOwned


class AiAnalysisJob(TenantOwned, Base):
    __tablename__ = "ai_analysis_jobs"

    id = Column(Integer, primary_key=True, index=True)

    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    status = Column(String(20), nullable=False, default="PENDING", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    available_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    lease_token = Column(String(64), nullable=True)
    locked_until = Column(DateTime, nullable=True)

    priority = Column(Integer, nullable=False, default=0)
    last_error_code = Column(String(50), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    event = relationship("Event")

    __table_args__ = (
        Index("ix_ai_jobs_status_available", "status", "available_at"),
    )
