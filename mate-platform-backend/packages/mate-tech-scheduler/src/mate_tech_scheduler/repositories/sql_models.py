"""DAG scheduling control-plane ORM models (SQLAlchemy 2.0).

Mirrors the ``SchedulerTask`` dataclass in in_memory.py. The
``config`` dict is serialised as JSON TEXT.

The DAG graph (``DagNode``) is computed at runtime from task
dependencies and is not persisted here — it stays in in_memory.
"""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class SchedulerTaskORM(Base):
    __tablename__ = "scheduler_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    cron_expression: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active")
    config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")
    last_run_at: Mapped[str] = mapped_column(String(64), default="")
