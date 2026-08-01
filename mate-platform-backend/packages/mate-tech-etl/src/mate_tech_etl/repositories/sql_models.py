"""ETL task control-plane ORM models (SQLAlchemy 2.0).

Mirrors the ``EtlTask`` dataclass in in_memory.py. The ``config``
dict is serialised as JSON TEXT.
"""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class EtlTaskORM(Base):
    __tablename__ = "etl_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    source_table: Mapped[str] = mapped_column(String(128), nullable=False)
    target_table: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="idle")
    config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")
    last_run_at: Mapped[str] = mapped_column(String(64), default="")
