from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, CheckConstraint, Index, text
from datetime import datetime


from sqlalchemy.orm import relationship
from app.database.base import Base, TenantOwned


class Website(TenantOwned, Base):
    __tablename__ = "websites"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), index=True)
    url = Column(String(255), index=True)
    domain = Column(String(255), index=True)
    ip_address = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)

    exposure = Column(String(20), nullable=False, server_default="public", default="public")
    archived_at = Column(DateTime, nullable=True, index=True)

    environment = Column(String(50), default="Production")
    status = Column(String(50), default="Active")
    security_score = Column(Integer, nullable=True)
    owner = Column(String(255), nullable=True)

    favicon_url = Column(String(255), nullable=True)
    monitoring_enabled = Column(Boolean, default=True)
    tags = Column(Text, nullable=True)  # Comma-separated tags
    notes = Column(Text, nullable=True)

    health_status = Column(String(50), default="Unknown")

    last_scan = Column(DateTime, nullable=True)

    integrations = relationship(
        "Integration",
        back_populates="website",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def integration(self):
        return next((i for i in self.integrations if getattr(i, "kind", "legacy") == "legacy"), None)

    enrollment_tokens = relationship(
        "EnrollmentToken",
        back_populates="website",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )



    # Website Ownership Verification
    verified = Column(Boolean, default=False, nullable=False)
    verification_method = Column(String(20), nullable=True)
    verification_token = Column(String(128), unique=True, nullable=True)
    verified_at = Column(DateTime, nullable=True)

    # Verified scan target and address allowlist. The scanner agent performs
    # its own validation against these values; they are informational here.
    verified_target = Column(String(255), nullable=True)
    verified_addresses = Column(JSON, nullable=True)

    # Intrusive scan authorization & policy (explicit consent required)
    intrusive_scans_authorized_at = Column(DateTime, nullable=True)
    intrusive_scans_authorized_by = Column(Integer, nullable=True)
    scan_policy = Column(JSON, nullable=True)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint("exposure IN ('public', 'internal')", name="ck_websites_exposure"),
        Index(
            "ix_websites_org_url_active",
            "organization_id",
            "url",
            unique=True,
            sqlite_where=text("archived_at IS NULL"),
            postgresql_where=text("archived_at IS NULL"),
        ),
    )

