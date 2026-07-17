"""SQLAlchemy 2.0 ORM model for the ``agent_definition`` table.

Used by :class:`SqlAlchemyAgentRepository` in production. The table is created
automatically (``create_all``) on startup when a real database is configured;
tests use :class:`InMemoryAgentRepository` instead.
"""

from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class AgentORM(Base):
    """ORM mapping for ``agent_definition``."""

    __tablename__ = "agent_definition"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    agent_code = Column(String(128), nullable=False)
    name = Column(String(256), nullable=False)
    description = Column(String(1024), nullable=True)
    model_id = Column(String(256), nullable=False)
    system_prompt = Column(String(8192), nullable=False)
    tools = Column(JSON, nullable=False, default=list)
    rag_scopes = Column(JSON, nullable=False, default=list)
    temperature = Column(String(16), nullable=False, default="0.7")
    max_tokens = Column(String(16), nullable=False, default="4096")
    status = Column(String(32), nullable=False, default="DRAFT")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "agent_code", name="uq_agent_tenant_code"),
    )
