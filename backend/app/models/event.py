from datetime import datetime, timedelta

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

from app.database.base import Base


class Event(Base):
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

    created_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(hours=5, minutes=30),
    )

    website = relationship("Website")
    integration = relationship("Integration")