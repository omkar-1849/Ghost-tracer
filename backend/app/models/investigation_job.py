from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database.base import Base, TenantOwned


class InvestigationJob(TenantOwned, Base):
    __tablename__ = "investigation_jobs"

    id = Column(Integer, primary_key=True, index=True)

    investigation_id = Column(
        Integer,
        ForeignKey("investigations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    status = Column(String(20), default="PENDING", nullable=False, index=True)
    priority = Column(Integer, default=100, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)
    lease_token = Column(String(64), nullable=True)
    locked_until = Column(DateTime, nullable=True, index=True)
    last_error_code = Column(String(50), nullable=True)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    investigation = relationship("Investigation", back_populates="job", foreign_keys=[investigation_id])
