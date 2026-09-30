from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime

from app.database.base import Base, TenantOwned


class IncidentTimeline(TenantOwned, Base):
    __tablename__ = "incident_timeline"

    id = Column(Integer, primary_key=True, index=True)

    incident_id = Column(Integer, ForeignKey("incidents.id"))

    event = Column(String(100))

    description = Column(String(255))

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )