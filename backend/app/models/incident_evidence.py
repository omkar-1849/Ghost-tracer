from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime, timedelta

from app.database.base import Base


class IncidentEvidence(Base):
    __tablename__ = "incident_evidence"

    id = Column(Integer, primary_key=True, index=True)

    incident_id = Column(Integer, ForeignKey("incidents.id"))

    filename = Column(String(255))
    file_type = Column(String(100))
    description = Column(String(255))

    url = Column(String(500), nullable=True)

    method = Column(String(20), nullable=True)

    status_code = Column(Integer, nullable=True)

    user_agent = Column(String(500), nullable=True)

    ip_address = Column(String(50), nullable=True)

    risk_score = Column(Integer, nullable=True)

    detection_reason = Column(String(500), nullable=True)

    created_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30)
    )