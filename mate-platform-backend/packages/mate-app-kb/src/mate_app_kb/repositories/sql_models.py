"""kb domain ORM models (SQLAlchemy 2.0) — P3-W4 TD-5.

Table names are prefixed with ``kb_``.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class KbCollectionORM(Base):
    __tablename__ = "kb_collections"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="active")
    config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class KbDocumentORM(Base):
    __tablename__ = "kb_documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    collection_id: Mapped[str] = mapped_column(String(64), default="")
    document_id: Mapped[str] = mapped_column(String(64), default="")
    filename: Mapped[str] = mapped_column(String(256), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="indexed")
    meta: Mapped[str] = mapped_column(Text, default="{}")  # JSON (avoids reserved 'metadata')
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class KbSearchLogORM(Base):
    __tablename__ = "kb_search_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    query: Mapped[str] = mapped_column(Text, default="")
    mode: Mapped[str] = mapped_column(String(32), default="hybrid")
    total_hits: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(64), default="")


class KbRetrievalConfigORM(Base):
    """Tenant-scoped global retrieval configuration (one row per tenant).

    Column defaults mirror the ``in_memory.KbRetrievalConfig`` dataclass
    defaults so a first ``get`` can materialise the default row (same
    "create default on first access" semantics as the in-memory store:
    ``version=1`` + blank ``updated_at`` mark a never-user-saved config —
    the API layer's version-increment logic depends on both).
    """

    __tablename__ = "kb_retrieval_config"

    tenant_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    mode: Mapped[str] = mapped_column(String(32), default="AUTO")
    rerank_strategy: Mapped[str] = mapped_column(String(64), default="identity")
    top_k: Mapped[int] = mapped_column(Integer, default=10)
    similarity_threshold: Mapped[float] = mapped_column(Float, default=0.0)
    chunk_strategy: Mapped[str] = mapped_column(String(64), default="recursive")
    chunk_size: Mapped[int] = mapped_column(Integer, default=512)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=64)
    vector_weight: Mapped[float] = mapped_column(Float, default=0.7)
    keyword_weight: Mapped[float] = mapped_column(Float, default=0.3)
    reranker_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    show_citations: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class KbRetrievalConfigSnapshotORM(Base):
    """Prior-version snapshot of a tenant's retrieval config (P1.8 history).

    ``id`` is the natural key ``{tenant_id}:{version}`` (PK). ``seq`` is a
    per-tenant insertion counter that reproduces the in-memory store's
    append-order semantics: FIFO cap (keep newest 10) and "newest last"
    list ordering are driven by ``seq``, not by ``version`` or
    ``snapshot_at`` (second-resolution timestamps can collide).
    """

    __tablename__ = "kb_retrieval_config_snapshot"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=0)
    mode: Mapped[str] = mapped_column(String(32), default="AUTO")
    rerank_strategy: Mapped[str] = mapped_column(String(64), default="identity")
    top_k: Mapped[int] = mapped_column(Integer, default=10)
    similarity_threshold: Mapped[float] = mapped_column(Float, default=0.0)
    chunk_strategy: Mapped[str] = mapped_column(String(64), default="recursive")
    chunk_size: Mapped[int] = mapped_column(Integer, default=512)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=64)
    vector_weight: Mapped[float] = mapped_column(Float, default=0.7)
    keyword_weight: Mapped[float] = mapped_column(Float, default=0.3)
    reranker_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    show_citations: Mapped[bool] = mapped_column(Boolean, default=True)
    snapshot_at: Mapped[str] = mapped_column(String(64), default="")
    seq: Mapped[int] = mapped_column(Integer, default=0, index=True)
