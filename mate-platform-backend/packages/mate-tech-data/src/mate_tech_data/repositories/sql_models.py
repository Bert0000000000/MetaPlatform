"""Data platform control-plane ORM models (SQLAlchemy 2.0).

Mirrors the ``CdcTask`` / ``DataSource`` dataclasses in in_memory.py.
Dict fields (``config`` / ``connection_config``) are serialised as
JSON TEXT on write and re-hydrated to dicts on read.

Table names are prefixed with ``data_`` to match the ``mate_tech_data``
package. Schema discovery results (``get_source_schema``) stay in
in-memory because they are dynamic and per-source; this SQL layer
only persists the two core entities.
"""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class CdcTaskORM(Base):
    __tablename__ = "data_cdc_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    target_table: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="running")
    config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class DataSourceORM(Base):
    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    connection_config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    status: Mapped[str] = mapped_column(String(32), default="connected")
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")
