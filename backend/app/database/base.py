from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import declarative_base, declared_attr

Base = declarative_base()


class TenantOwned:
    @declared_attr
    def organization_id(cls):
        # NULL preserves unassigned legacy records without making them accessible.
        return Column(
            Integer, ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=True, index=True,
        )
