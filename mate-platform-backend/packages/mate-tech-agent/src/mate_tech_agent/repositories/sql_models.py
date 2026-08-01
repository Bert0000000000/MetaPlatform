"""agent domain ORM models (SQLAlchemy 2.0) — P3-W4 TD-5.

Table names are prefixed with ``agent_``.
"""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class AgentORM(Base):
    __tablename__ = "agent_agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    scenario: Mapped[str] = mapped_column(String(32), default="S1")
    model_id: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(32), default="active")
    config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class AgentSessionORM(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    agent_id: Mapped[str] = mapped_column(String(64), default="")
    thread_id: Mapped[str] = mapped_column(String(64), default="")
    scenario: Mapped[str] = mapped_column(String(32), default="S1")
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class AgentMessageORM(Base):
    __tablename__ = "agent_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    thread_id: Mapped[str] = mapped_column(String(64), default="")
    role: Mapped[str] = mapped_column(String(32), default="user")
    content: Mapped[str] = mapped_column(Text, default="")
    tool_calls: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    created_at: Mapped[str] = mapped_column(String(64), default="")
