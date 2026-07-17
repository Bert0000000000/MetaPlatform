"""SQLAlchemy 2.0 ORM models for memory (sessions and messages)."""

from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, Integer, String, func
from sqlalchemy.orm import DeclarativeBase

from app.agents.orm import Base


class MemorySessionORM(Base):
    """ORM mapping for ``agent_memory_sessions``."""

    __tablename__ = "agent_memory_sessions"

    session_id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(64), nullable=False, index=True)
    title = Column(String(512), nullable=True, default="")
    message_count = Column(Integer, nullable=False, default=0)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MemoryMessageORM(Base):
    """ORM mapping for ``agent_memory_messages``."""

    __tablename__ = "agent_memory_messages"

    id = Column(String(64), primary_key=True)
    session_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(64), nullable=False, index=True)
    role = Column(String(32), nullable=False)
    content = Column(String(16384), nullable=False)
    meta_data = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
