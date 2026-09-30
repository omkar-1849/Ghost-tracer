from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.base import Base, TenantOwned


class Alert(TenantOwned, Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)

    # Correlation links (security history must survive website deletion).
    # Legacy rows created before these columns existed remain NULL.
    website_id = Column(
        Integer,
        ForeignKey("websites.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    log_id = Column(
        Integer,
        ForeignKey("logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    ip_address = Column(String(50))
    threat_level = Column(String(20))
    message = Column(String(255))

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    website = relationship("Website", foreign_keys=[website_id])
    event = relationship("Event", foreign_keys=[event_id])
    log = relationship("Log", foreign_keys=[log_id])
