"""Metrics control-plane ORM models (SQLAlchemy 2.0).

Mirrors the ``Metric`` dataclass in in_memory.py. The ``config`` dict
is serialised as JSON TEXT.

Lineage and computed values stay in in_memory because they are
dynamic (recomputed per run) and not part of the persistence
contract.
"""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class MetricORM(Base):
    __tablename__ = "metrics"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    expression: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    description: Mapped[str] = mapped_column(Text, default="")
    config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")
    last_computed_at: Mapped[str] = mapped_column(String(64), default="")
