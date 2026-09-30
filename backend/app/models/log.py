from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.base import Base, TenantOwned


class Log(TenantOwned, Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)

    # Proven parent link (security history must survive website deletion).
    # Legacy rows created before this column existed remain NULL.
    website_id = Column(
        Integer,
        ForeignKey("websites.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    ip_address = Column(String(50))
    method = Column(String(10))
    url = Column(String(255))
    status_code = Column(Integer)
    user_agent = Column(String(255))
    message = Column(String(255))

    risk_score = Column(Integer)
    threat_level = Column(String(20))
    detection_reason = Column(String(255))

    timestamp = Column(
        DateTime,
        default=datetime.utcnow,
    )

    website = relationship("Website", foreign_keys=[website_id])
