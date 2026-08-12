"""Copilot ORM models (SQLAlchemy 2.0) — maps to Postgres/SQLite tables.

These models mirror the frozen dataclasses in in_memory.py. The
factory in repositories/__init__.py selects between in-memory and
SQL backends based on MATE_DB_URL env var.

v3.2 proof-of-concept: implements 5 of the 10 tables (Conversation,
QueryLog, Plan, Intent, Action). The remaining 5 follow the same
pattern and will be added incrementally.
"""
from __future__ import annotations

from sqlalchemy import REAL, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class ConversationORM(Base):
    __tablename__ = "copilot_conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(64), default="")
    mode: Mapped[str] = mapped_column(String(32), default="chat")
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[str] = mapped_column(String(64), default="")
    preview: Mapped[str] = mapped_column(Text, default="")


class MessageORM(Base):
    __tablename__ = "copilot_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user|assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), default="")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")


class QueryLogORM(Base):
    __tablename__ = "copilot_queries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    sql: Mapped[str] = mapped_column(Text, nullable=False)
    datasource_id: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="ok")
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(64), default="")


class PlanORM(Base):
    __tablename__ = "copilot_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    steps: Mapped[str] = mapped_column(Text, default="")  # newline-separated
    status: Mapped[str] = mapped_column(String(32), default="draft")


class IntentORM(Base):
    __tablename__ = "copilot_intents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    keywords: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    confidence: Mapped[float] = mapped_column(REAL, default=0.0)


class ActionORM(Base):
    __tablename__ = "copilot_actions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="general")
    keywords: Mapped[str] = mapped_column(Text, default="")  # comma-separated


class DatasourceORM(Base):
    __tablename__ = "copilot_datasources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="active")


class KnowledgeBaseORM(Base):
    __tablename__ = "copilot_knowledge_bases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    doc_count: Mapped[int] = mapped_column(Integer, default=0)


class ModelInfoORM(Base):
    __tablename__ = "copilot_models"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    provider: Mapped[str] = mapped_column(String(128), nullable=False)
    modality: Mapped[str] = mapped_column(String(64), default="multimodal")
    status: Mapped[str] = mapped_column(String(32), default="available")


class TemplateORM(Base):
    __tablename__ = "copilot_templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")


class AssetORM(Base):
    __tablename__ = "copilot_assets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    embedding_dim: Mapped[int] = mapped_column(Integer, default=1536)
