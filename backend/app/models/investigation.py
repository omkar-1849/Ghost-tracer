from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database.base import Base, TenantOwned


class Investigation(TenantOwned, Base):
    __tablename__ = "investigations"

    id = Column(Integer, primary_key=True, index=True)

    website_id = Column(
        Integer,
        ForeignKey("websites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trigger_scan_id = Column(
        Integer,
        ForeignKey("scans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status = Column(String(20), default="PENDING", nullable=False, index=True)
    title = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    risk_level = Column(String(20), nullable=True)
    confidence = Column(Float, nullable=True)
    evidence_status = Column(String(50), nullable=True)

    evidence_bundle = Column(JSON, nullable=True)
    report = Column(JSON, nullable=True)
    generated_by = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    website = relationship("Website", foreign_keys=[website_id])
    trigger_scan = relationship("Scan", foreign_keys=[trigger_scan_id])
    job = relationship(
        "InvestigationJob",
        uselist=False,
        back_populates="investigation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
