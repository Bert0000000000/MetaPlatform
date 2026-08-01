"""wfe domain ORM models (SQLAlchemy 2.0) — P3-W3 TD-5.

Mirrors the frozen dataclasses in in_memory.py. The factory in
repositories/__init__.py selects between in-memory and SQL backends
based on MATE_DB_URL env var.

Table names are prefixed with ``wfe_``. Tuple fields
(``FlowValidation.issues``) are stored as newline-separated TEXT;
dict fields (``FlowTestRun.output``) are stored as JSON TEXT. Both
are re-hydrated by the ``_orm_to_*`` helpers in sql_store.py.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class FlowDefinitionORM(Base):
    __tablename__ = "wfe_flow_definitions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    bpmn_xml: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[str] = mapped_column(String(32), default="1.0")
    status: Mapped[str] = mapped_column(String(32), default="draft")


class FlowValidationORM(Base):
    __tablename__ = "wfe_flow_validations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    flow_id: Mapped[str] = mapped_column(String(64), default="")
    valid: Mapped[bool] = mapped_column(Boolean, default=False)
    issues: Mapped[str] = mapped_column(Text, default="")  # newline-separated
    validated_at: Mapped[str] = mapped_column(String(64), default="")


class FlowTestRunORM(Base):
    __tablename__ = "wfe_flow_test_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    flow_id: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(32), default="success")
    started_at: Mapped[str] = mapped_column(String(64), default="")
    finished_at: Mapped[str] = mapped_column(String(64), default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    output: Mapped[str] = mapped_column(Text, default="{}")  # JSON
