"""SQLAlchemy 2.0 ORM model for the ``agent_tasks`` table."""

from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, String, func
from sqlalchemy.orm import DeclarativeBase

from app.agents.orm import Base


class TaskORM(Base):
    """ORM mapping for ``agent_tasks``."""

    __tablename__ = "agent_tasks"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(64), nullable=False, index=True)
    title = Column(String(512), nullable=False)
    description = Column(String(2048), nullable=True)
    status = Column(String(32), nullable=False, default="PENDING")
    priority = Column(String(32), nullable=False, default="MEDIUM")
    assigned_to = Column(String(128), nullable=True)
    input = Column(JSON, nullable=True)
    output = Column(JSON, nullable=True)
    error_message = Column(String(2048), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
