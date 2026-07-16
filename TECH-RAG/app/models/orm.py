"""SQLAlchemy 2.0 ORM models for ``rag_knowledge_base`` and ``rag_document``.

Used by the SqlAlchemy repositories in production. Tables are created
automatically (``create_all``) on startup when a real database is configured;
tests use the in-memory repositories instead.
"""

from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class KnowledgeBaseORM(Base):
    """ORM mapping for ``rag_knowledge_base``."""

    __tablename__ = "rag_knowledge_base"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(String(1024), nullable=True)
    status = Column(String(16), nullable=False, default="ACTIVE")
    doc_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_rag_kb_tenant_name"),
    )


class DocumentORM(Base):
    """ORM mapping for ``rag_document``."""

    __tablename__ = "rag_document"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    kb_id = Column(
        String(64),
        ForeignKey("rag_knowledge_base.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = Column(String(512), nullable=False)
    file_size = Column(BigInteger, nullable=False, default=0)
    file_type = Column(String(16), nullable=False)
    storage_path = Column(String(1024), nullable=False)
    status = Column(String(16), nullable=False, default="UPLOADED")
    chunk_count = Column(Integer, nullable=False, default=0)
    # ``metadata`` is reserved by SQLAlchemy Declarative API; use attribute
    # name ``meta`` and map it to the ``metadata`` column in the database.
    meta = Column("metadata", JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DocumentChunkORM(Base):
    """ORM mapping for ``rag_document_chunk``."""

    __tablename__ = "rag_document_chunk"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    document_id = Column(
        String(64),
        ForeignKey("rag_document.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False, default=0)
    embedding_status = Column(String(16), nullable=False, default="PENDING")
    embedding = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
