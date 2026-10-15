from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
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
        index=True,
    )

    name = Column(String(100), nullable=True)
    kind = Column(String(20), nullable=False, server_default="legacy", default="legacy")

    api_key_hash = Column(String(255), nullable=False)
    api_secret_hash = Column(String(255), nullable=True)

    key_prefix = Column(String(16), nullable=True)
    previous_key_hash = Column(String(64), nullable=True, index=True)
    previous_key_expires_at = Column(DateTime, nullable=True)

    enrollment_token_id = Column(
        Integer,
        ForeignKey("enrollment_tokens.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    version = Column(String(50), nullable=True)
    hostname = Column(String(255), nullable=True)
    last_heartbeat_at = Column(DateTime, nullable=True)
    last_seen_ip = Column(String(45), nullable=True)

    status = Column(
        String(20),
        default="Connected",
        nullable=False,
    )

    revoked_at = Column(
        DateTime,
        nullable=True,
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
        back_populates="integrations",
        passive_deletes=True,
    )

    enrollment_token = relationship(
        "EnrollmentToken",
        foreign_keys=[enrollment_token_id],
    )

    __table_args__ = (
        CheckConstraint("status IN ('Connected', 'Revoked', 'Disabled')", name="ck_integrations_status"),
        CheckConstraint("kind IN ('legacy', 'daemon', 'nginx', 'sdk')", name="ck_integrations_kind"),
        Index("ix_integrations_api_key_hash", "api_key_hash", unique=True),
    )
