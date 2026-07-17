"""SQLAlchemy 2.0 ORM model for the ``agent_tools`` table."""

from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, String, func
from sqlalchemy.orm import DeclarativeBase

from app.agents.orm import Base


class ToolORM(Base):
    """ORM mapping for ``agent_tools``."""

    __tablename__ = "agent_tools"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(64), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    description = Column(String(1024), nullable=True)
    tool_type = Column(String(32), nullable=False, default="ACTION")
    config = Column(JSON, nullable=False, default=dict)
    input_schema = Column(JSON, nullable=True)
    output_schema = Column(JSON, nullable=True)
    enabled = Column(String(8), nullable=False, default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
