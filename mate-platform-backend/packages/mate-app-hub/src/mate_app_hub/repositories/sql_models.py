"""Apphub ORM models (SQLAlchemy 2.0).

These models mirror the frozen dataclasses in in_memory.py. The
factory in repositories/__init__.py selects between in-memory and
SQL backends based on MATE_DB_URL env var.

Table names are prefixed with ``apphub_``. Tuple fields (``tags``)
are stored as newline-separated TEXT; dict fields (``content``) are
stored as JSON TEXT. Re-hydration is done by the ``_orm_to_*``
helpers in sql_store.py.
"""
from __future__ import annotations

from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class ApphubAppORM(Base):
    __tablename__ = "apphub_apps"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[str] = mapped_column(String(32), default="1.0.0")
    owner: Mapped[str] = mapped_column(String(128), default="platform-team")
    tags: Mapped[str] = mapped_column(Text, default="")  # newline-separated


class ApphubGroupORM(Base):
    __tablename__ = "apphub_groups"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    icon: Mapped[str] = mapped_column(String(64), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class ApphubModuleORM(Base):
    __tablename__ = "apphub_modules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    app_code: Mapped[str] = mapped_column(String(64), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    entry_path: Mapped[str] = mapped_column(String(256), default="")


class ApphubPageORM(Base):
    __tablename__ = "apphub_pages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    module_code: Mapped[str] = mapped_column(String(64), default="")
    layout: Mapped[str] = mapped_column(String(32), default="single")
    schema_version: Mapped[int] = mapped_column(Integer, default=1)


class ApphubTemplateORM(Base):
    __tablename__ = "apphub_templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    template_type: Mapped[str] = mapped_column(String(32), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="{}")  # JSON


class ApphubShortlinkORM(Base):
    """Short-link persistence (APPHUB-RUNTIME-01 K3-1).

    Mirrors ``shortlink.repository.ShortlinkEntry``. Codes are unique
    per tenant via the composite index on ``(tenant_id, code)``.
    """

    __tablename__ = "apphub_shortlinks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    app_id: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    role: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_apphub_shortlinks_tenant_code", "tenant_id", "code", unique=True),
        Index("ix_apphub_shortlinks_tenant_app", "tenant_id", "app_id"),
    )
