from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database.base import Base, TenantOwned


class Integration(TenantOwned, Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)

    website_id = Column(
        Integer,
        ForeignKey(
            "websites.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
        index=True,
    )

    api_key_hash = Column(String(255), nullable=False)
    api_secret_hash = Column(String(255), nullable=False)

    status = Column(
        String(20),
        default="Connected",
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    last_used = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    website = relationship(
        "Website",
        back_populates="integration",
        passive_deletes=True,
    )