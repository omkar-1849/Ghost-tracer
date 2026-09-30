from datetime import datetime

from sqlalchemy import (
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


class Event(TenantOwned, Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)

    website_id = Column(
        Integer,
        ForeignKey("websites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    integration_id = Column(
        Integer,
        ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type = Column(String(100), nullable=False)
    severity = Column(String(20), default="Info")
    source = Column(String(100), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)

    event_metadata = Column(JSON, nullable=True)

    # Normalized / dedup / analysis fields (UTC semantics; legacy rows may be NULL)
    fingerprint = Column(String(64), nullable=True, index=True)
    risk_score = Column(Integer, nullable=True)
    threat_level = Column(String(20), nullable=True)
    detection_result = Column(JSON, nullable=True)
    analyst_result = Column(JSON, nullable=True)
    normalization_version = Column(Integer, nullable=True)
    processed_at = Column(DateTime, nullable=True)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    website = relationship("Website")
    integration = relationship("Integration")