"""A2A ORM models (SQLAlchemy 2.0) — maps to Postgres/SQLite tables.

These models mirror the dataclasses in in_memory.py. The
factory in repositories/__init__.py selects between in-memory and
SQL backends based on MATE_DB_URL env var.

Dict fields (input_schema / output_schema / context / result) are
stored as JSON-encoded Text. The `capabilities` tuple is stored as a
comma-separated Text column, matching the copilot sql_models pattern.
"""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class AgentORM(Base):
    __tablename__ = "a2a_agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    endpoint: Mapped[str] = mapped_column(String(256), default="")
    status: Mapped[str] = mapped_column(String(32), default="active")


class AgentCapabilityORM(Base):
    __tablename__ = "a2a_agent_capabilities"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    input_schema: Mapped[str] = mapped_column(Text, default="")  # JSON-encoded
    output_schema: Mapped[str] = mapped_column(Text, default="")  # JSON-encoded


class DelegationTaskORM(Base):
    __tablename__ = "a2a_delegations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_agent_id: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[str] = mapped_column(Text, default="")  # JSON-encoded
    status: Mapped[str] = mapped_column(String(32), default="pending")
    result: Mapped[str] = mapped_column(Text, default="")  # JSON-encoded
    created_at: Mapped[str] = mapped_column(String(64), default="")


class ExternalAgentORM(Base):
    __tablename__ = "a2a_external_agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(256), nullable=False)
    capabilities: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    status: Mapped[str] = mapped_column(String(32), default="registered")


class TaskResultORM(Base):
    __tablename__ = "a2a_task_results"

    task_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    result: Mapped[str] = mapped_column(Text, default="")  # JSON-encoded
    status: Mapped[str] = mapped_column(String(32), default="")
