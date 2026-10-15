from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database.base import Base, TenantOwned


class ScannerFinding(TenantOwned, Base):
    __tablename__ = "scanner_findings"

    id = Column(Integer, primary_key=True, index=True)

    website_id = Column(
        Integer,
        ForeignKey("websites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scan_id = Column(
        Integer,
        ForeignKey("scans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    fingerprint = Column(String(64), nullable=False, index=True)
    engine = Column(String(50), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False, index=True)
    severity_basis = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=False, default=1.0)

    affected_asset = Column(JSON, nullable=True)
    cwe = Column(JSON, nullable=True)
    cve = Column(JSON, nullable=True)

    status = Column(String(20), nullable=False, default="open", index=True)
    first_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    seen_count = Column(Integer, default=1, nullable=False)

    first_seen_scan_id = Column(Integer, nullable=True)
    last_seen_scan_id = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    website = relationship("Website", foreign_keys=[website_id])
    scan = relationship("Scan", foreign_keys=[scan_id])
    observations = relationship(
        "ScannerFindingObservation",
        back_populates="finding",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
