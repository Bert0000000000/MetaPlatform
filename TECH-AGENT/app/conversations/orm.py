"""SQLAlchemy 2.0 ORM models for conversations and messages."""

from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, Integer, String, func
from sqlalchemy.orm import DeclarativeBase

from app.agents.orm import Base


class ConversationORM(Base):
    """ORM mapping for ``agent_conversations``."""

    __tablename__ = "agent_conversations"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(64), nullable=False, index=True)
    title = Column(String(512), nullable=True, default="")
    status = Column(String(32), nullable=False, default="ACTIVE")
    message_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_message_at = Column(DateTime(timezone=True), nullable=True)


class ConversationMessageORM(Base):
    """ORM mapping for ``agent_messages``."""

    __tablename__ = "agent_messages"

    id = Column(String(64), primary_key=True)
    conversation_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    role = Column(String(32), nullable=False)
    content = Column(String(16384), nullable=False)
    meta_data = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
