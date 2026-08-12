"""Orchestrator ORM models (SQLAlchemy 2.0).

Mirrors the digital-employee role dataclasses. Composite PK
``(tenant_id, role)``; capabilities stored as JSON-encoded Text.
"""
from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class RoleORM(Base):
    __tablename__ = "orchestrator_roles"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    role: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    capabilities: Mapped[str] = mapped_column(Text, default="[]")  # JSON-encoded
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(64), default="")
