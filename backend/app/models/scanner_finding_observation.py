from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.database.base import Base, TenantOwned


class ScannerFindingObservation(TenantOwned, Base):
    __tablename__ = "scanner_finding_observations"

    id = Column(Integer, primary_key=True, index=True)

    finding_id = Column(
        Integer,
        ForeignKey("scanner_findings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scan_id = Column(
        Integer,
        ForeignKey("scans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    engine = Column(String(50), nullable=False)
    scanner_rule_id = Column(String(100), nullable=True)
    raw_severity = Column(String(20), nullable=True)
    confidence = Column(Float, default=1.0, nullable=False)
    evidence_data = Column(JSON, nullable=True)
    observed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    finding = relationship("ScannerFinding", back_populates="observations", foreign_keys=[finding_id])
    scan = relationship("Scan", foreign_keys=[scan_id])
