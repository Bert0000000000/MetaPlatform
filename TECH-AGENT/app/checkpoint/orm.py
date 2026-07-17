"""SQLAlchemy 2.0 ORM model for the ``agent_checkpoints`` table."""

from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, String, func
from sqlalchemy.orm import DeclarativeBase

from app.agents.orm import Base


class CheckpointORM(Base):
    """ORM mapping for ``agent_checkpoints``."""

    __tablename__ = "agent_checkpoints"

    checkpoint_id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(64), nullable=False, index=True)
    state = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
