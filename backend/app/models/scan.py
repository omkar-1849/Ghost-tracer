from datetime import datetime

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

from app.database.base import Base, TenantOwned


class Scan(TenantOwned, Base):
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
        default=datetime.utcnow,
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

    # Scan worker coordination (UTC semantics)
    worker_id = Column(String(64), nullable=True)
    heartbeat_at = Column(DateTime, nullable=True)
    truncated = Column(Boolean, default=False, server_default="0", nullable=False)
    version = Column(Integer, default=0, server_default="0", nullable=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    website = relationship("Website")
