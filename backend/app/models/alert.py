from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timedelta

from app.database.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)

    ip_address = Column(String(50))
    threat_level = Column(String(20))
    message = Column(String(255))

    created_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )