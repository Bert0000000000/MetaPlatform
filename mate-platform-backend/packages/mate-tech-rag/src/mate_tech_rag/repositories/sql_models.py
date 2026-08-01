"""rag domain ORM models (SQLAlchemy 2.0) — P3-W4 TD-5.

Mirrors the frozen dataclasses in in_memory.py. Dict fields
(``RagDocument.metadata``) are stored as JSON TEXT and re-hydrated
by sql_store.py.

Table names are prefixed with ``rag_``.
"""
from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class RagDocumentORM(Base):
    __tablename__ = "rag_documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    document_id: Mapped[str] = mapped_column(String(64), default="")
    filename: Mapped[str] = mapped_column(String(256), default="")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    meta: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    status: Mapped[str] = mapped_column(String(32), default="indexed")
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class RagIndexORM(Base):
    __tablename__ = "rag_indexes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    backend: Mapped[str] = mapped_column(String(32), default="memory")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[str] = mapped_column(String(64), default="")
