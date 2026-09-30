from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.base import Base, TenantOwned


class Incident(TenantOwned, Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)

    incident_code = Column(String(30), unique=True, index=True)

    # Correlation links (security history must survive website deletion).
    # Legacy rows created before these columns existed remain NULL.
    website_id = Column(
        Integer,
        ForeignKey("websites.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    alert_id = Column(
        Integer,
        ForeignKey("alerts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title = Column(String(255))
    description = Column(String(500))

    threat_level = Column(String(20))
    priority = Column(String(10))
    status = Column(String(30))

    source_ip = Column(String(50))
    target = Column(String(255))

    confidence = Column(Integer)

    assigned_to = Column(String(100), nullable=True)
    assigned_at = Column(DateTime, nullable=True)

    # Assigned analyst (nullable users FK; unknown legacy assignees stay NULL).
    assigned_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    resolved_at = Column(DateTime, nullable=True)

    website = relationship("Website", foreign_keys=[website_id])
    alert = relationship("Alert", foreign_keys=[alert_id])
