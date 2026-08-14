"""Digital workforce ORM models (SQLAlchemy 2.0).

These models mirror the frozen dataclasses in in_memory.py. The
factory in repositories/__init__.py selects between in-memory and
SQL backends based on MATE_DB_URL env var.

Table names are prefixed with ``dw_``. The single tuple field
(``DwEmployee.kb_ids``) is stored as newline-separated TEXT and
re-hydrated by the ``_orm_to_*`` helpers in sql_store.py.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class DwAuthLoginORM(Base):
    __tablename__ = "dw_auth_logins"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    login_at: Mapped[str] = mapped_column(String(64), default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(32), default="success")


class DwCollaborationORM(Base):
    __tablename__ = "dw_collaborations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    peer_employee_id: Mapped[str] = mapped_column(String(64), default="")
    session_id: Mapped[str] = mapped_column(String(64), default="")
    started_at: Mapped[str] = mapped_column(String(64), default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)


class DwCommitORM(Base):
    __tablename__ = "dw_commits"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    scope: Mapped[str] = mapped_column(String(32), default="")
    target_id: Mapped[str] = mapped_column(String(64), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    committed_at: Mapped[str] = mapped_column(String(64), default="")


class DwDocumentORM(Base):
    __tablename__ = "dw_documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    kind: Mapped[str] = mapped_column(String(32), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by: Mapped[str] = mapped_column(String(64), default="")
    uploaded_at: Mapped[str] = mapped_column(String(64), default="")
    kb_id: Mapped[str] = mapped_column(String(64), default="")
    document_id: Mapped[str] = mapped_column(String(64), default="")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)


class DwEmployeeORM(Base):
    __tablename__ = "dw_employees"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    code: Mapped[str] = mapped_column(String(64), default="")
    role: Mapped[str] = mapped_column(String(32), default="")
    status: Mapped[str] = mapped_column(String(32), default="active")
    model_id: Mapped[str] = mapped_column(String(64), default="")
    kb_ids: Mapped[str] = mapped_column(Text, default="")  # newline-separated


class DwEmployeeTaskORM(Base):
    __tablename__ = "dw_employee_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    title: Mapped[str] = mapped_column(String(256), default="")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    started_at: Mapped[str] = mapped_column(String(64), default="")
    finished_at: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)


class DwEvaluationORM(Base):
    __tablename__ = "dw_evaluations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    qa_set_id: Mapped[str] = mapped_column(String(64), default="")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    evaluated_at: Mapped[str] = mapped_column(String(64), default="")


class DwExtractORM(Base):
    __tablename__ = "dw_extracts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    source: Mapped[str] = mapped_column(String(32), default="")
    source_id: Mapped[str] = mapped_column(String(64), default="")
    extracted_facts: Mapped[int] = mapped_column(Integer, default=0)
    extracted_at: Mapped[str] = mapped_column(String(64), default="")


class DwKnowledgeBaseORM(Base):
    __tablename__ = "dw_knowledge_bases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    code: Mapped[str] = mapped_column(String(64), default="")
    docs: Mapped[int] = mapped_column(Integer, default=0)
    vectors: Mapped[int] = mapped_column(Integer, default=0)
    owner: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class DwLearningExtractORM(Base):
    __tablename__ = "dw_learning_extracts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    scenario: Mapped[str] = mapped_column(String(128), default="")
    extracted_at: Mapped[str] = mapped_column(String(64), default="")
    facts: Mapped[int] = mapped_column(Integer, default=0)


class DwLearningFeedbackORM(Base):
    __tablename__ = "dw_learning_feedbacks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    scenario: Mapped[str] = mapped_column(String(128), default="")
    rating: Mapped[int] = mapped_column(Integer, default=0)
    comment: Mapped[str] = mapped_column(Text, default="")
    feedback_at: Mapped[str] = mapped_column(String(64), default="")


class DwModelORM(Base):
    __tablename__ = "dw_models"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), default="")
    model_id: Mapped[str] = mapped_column(String(128), default="")
    display_name: Mapped[str] = mapped_column(String(256), default="")
    modality: Mapped[str] = mapped_column(String(32), default="text")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class DwToolORM(Base):
    __tablename__ = "dw_tools"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    code: Mapped[str] = mapped_column(String(64), default="")
    kind: Mapped[str] = mapped_column(String(32), default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    invocations: Mapped[int] = mapped_column(Integer, default=0)


class DwTraceORM(Base):
    __tablename__ = "dw_traces"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), default="")
    trace_id: Mapped[str] = mapped_column(String(128), default="")
    span_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="ok")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[str] = mapped_column(String(64), default="")


class DwEmployeeConversationORM(Base):
    __tablename__ = "dw_employee_conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    employee_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class DwEmployeeMessageORM(Base):
    __tablename__ = "dw_employee_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    conversation_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(16), default="user")
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="completed")
    model: Mapped[str] = mapped_column(String(128), default="")
    sequence: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(64), default="")
