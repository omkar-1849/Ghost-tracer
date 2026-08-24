from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.base import Base


class ResponseAction(Base):
    __tablename__ = "response_actions"

    id = Column(Integer, primary_key=True, index=True)

    incident_id = Column(
        Integer,
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    action_type = Column(String(100), nullable=False)
    target = Column(String(255), nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)

    reason = Column(Text, nullable=True)
    result = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    executed_at = Column(
        DateTime,
        nullable=True,
    )

    incident = relationship("Incident")