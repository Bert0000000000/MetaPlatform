"""SQLAlchemy 2.0 ORM model for the ``data_source`` table.

Used by :class:`SqlAlchemyDataSourceRepository` in production. The table is
created automatically (``create_all``) on startup when a real database is
configured; tests use :class:`InMemoryDataSourceRepository` instead.
"""

from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class DataSourceORM(Base):
    """ORM mapping for ``data_source``."""

    __tablename__ = "data_source"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    source_type = Column(String(32), nullable=False)
    connection_config = Column(JSON, nullable=False)
    status = Column(String(16), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_data_source_tenant_name"),
    )


class DeliverableORM(Base):
    """ORM mapping for ``deliverable`` (P3-DASH-08, 09)."""

    __tablename__ = "deliverable"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    type = Column(String(32), nullable=False)
    title = Column(String(256), nullable=False)
    source = Column(String(128), nullable=False)
    description = Column(String(1024), nullable=True)
    format = Column(String(16), nullable=False)
    status = Column(String(16), nullable=False, default="ready")
    size = Column(Integer, default=0)
    created_by = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    download_url = Column(String(512), nullable=True)
