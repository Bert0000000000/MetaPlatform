"""SQLAlchemy 2.0 ORM models for execution steps, tool calls, and evaluations."""

from __future__ import annotations

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, func
from sqlalchemy.orm import DeclarativeBase

from app.agents.orm import Base


class StepORM(Base):
    """ORM mapping for ``agent_steps``."""

    __tablename__ = "agent_steps"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    step_type = Column(String(32), nullable=False)
    content = Column(String(16384), nullable=False)
    order = Column(Integer, nullable=False, default=0)
    meta_data = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ToolCallORM(Base):
    """ORM mapping for ``agent_tool_calls``."""

    __tablename__ = "agent_tool_calls"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    tool_name = Column(String(256), nullable=False)
    tool_input = Column(JSON, nullable=True)
    tool_output = Column(JSON, nullable=True)
    status = Column(String(32), nullable=False, default="SUCCESS")
    duration_ms = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EvaluationORM(Base):
    """ORM mapping for ``agent_evaluations``."""

    __tablename__ = "agent_evaluations"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    score = Column(Float, nullable=False, default=0.0)
    feedback = Column(String(2048), nullable=True, default="")
    evaluator = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
