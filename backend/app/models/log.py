from sqlalchemy import Column, Integer, String, DateTime
# from datetime import datetime
from zoneinfo import ZoneInfo
from datetime import datetime, timedelta
from app.database.base import Base


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)

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
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )