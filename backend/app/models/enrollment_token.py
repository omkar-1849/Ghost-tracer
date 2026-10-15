from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.database.base import Base, TenantOwned


class EnrollmentToken(TenantOwned, Base):
    __tablename__ = "enrollment_tokens"

    id = Column(Integer, primary_key=True, index=True)

    website_id = Column(
        Integer,
        ForeignKey(
            "websites.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    token_prefix = Column(String(16), nullable=False)
    label = Column(String(100), nullable=True)

    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    expires_at = Column(DateTime, nullable=False)
    max_uses = Column(Integer, nullable=False, default=1)
    used_count = Column(Integer, nullable=False, default=0)

    revoked_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    website = relationship(
        "Website",
        back_populates="enrollment_tokens",
    )

    created_by = relationship(
        "User",
        foreign_keys=[created_by_user_id],
    )

    __table_args__ = (
        CheckConstraint("max_uses >= 1 AND max_uses <= 50", name="ck_enrollment_tokens_max_uses"),
        CheckConstraint("used_count >= 0 AND used_count <= max_uses", name="ck_enrollment_tokens_used_count"),
    )
