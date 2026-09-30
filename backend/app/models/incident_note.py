from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime

from app.database.base import Base, TenantOwned


class IncidentNote(TenantOwned, Base):
    __tablename__ = "incident_notes"

    id = Column(Integer, primary_key=True, index=True)

    incident_id = Column(Integer, ForeignKey("incidents.id"))

    analyst = Column(String(100))
    note = Column(String(1000))

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )