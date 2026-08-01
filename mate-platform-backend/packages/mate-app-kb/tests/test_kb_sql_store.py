"""Tests for mate_app_kb.repositories.sql_store — SQL persistence (P3-W4).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation + JSON serialisation (config, metadata).
"""
from __future__ import annotations

import pytest

from mate_tech_db.base import Base, create_all, init_engine, reset_engine
from mate_app_kb.repositories import in_memory as mem
from mate_app_kb.repositories import sql_models as models  # noqa: F401
from mate_app_kb.repositories import sql_store as sql


@pytest.fixture(autouse=True)
def _fresh_db() -> None:
    """Reset the engine and create all tables before each test."""
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


# ---------------------------------------------------------------------------
# KbCollection round-trip (config JSON dict)
# ---------------------------------------------------------------------------
def test_put_and_get_collection() -> None:
    col = mem.KbCollection(
        id="kb-1", tenant_id=_TENANT_A, name="Sales KB",
        description="Sales knowledge base", document_count=12,
        status="active", config={"embedder": "text-embedding-3-small"},
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_collection(_TENANT_A, col)

    fetched = sql.get_collection(_TENANT_A, "kb-1")
    assert fetched is not None
    assert fetched.name == "Sales KB"
    assert fetched.description == "Sales knowledge base"
    assert fetched.document_count == 12
    assert fetched.status == "active"
    assert fetched.config == {"embedder": "text-embedding-3-small"}


def test_put_collection_upsert() -> None:
    col = mem.KbCollection(
        id="kb-2", tenant_id=_TENANT_A, name="Old",
        config={"embedder": "v1"},
    )
    sql.put_collection(_TENANT_A, col)
    col = mem.KbCollection(
        id="kb-2", tenant_id=_TENANT_A, name="New",
        document_count=20, status="archived",
        config={"embedder": "v2", "dim": 1536},
    )
    sql.put_collection(_TENANT_A, col)

    fetched = sql.get_collection(_TENANT_A, "kb-2")
    assert fetched is not None
    assert fetched.name == "New"
    assert fetched.document_count == 20
    assert fetched.status == "archived"
    assert fetched.config == {"embedder": "v2", "dim": 1536}


def test_delete_collection() -> None:
    sql.put_collection(_TENANT_A, mem.KbCollection(id="kb-del", tenant_id=_TENANT_A, name="del"))
    assert sql.delete_collection(_TENANT_A, "kb-del") is True
    assert sql.get_collection(_TENANT_A, "kb-del") is None
    assert sql.delete_collection(_TENANT_A, "kb-del") is False


def test_delete_collection_rejects_cross_tenant() -> None:
    sql.put_collection(_TENANT_A, mem.KbCollection(id="kb-x", tenant_id=_TENANT_A, name="x"))
    assert sql.delete_collection(_TENANT_B, "kb-x") is False
    assert sql.get_collection(_TENANT_A, "kb-x") is not None


# ---------------------------------------------------------------------------
# KbDocument round-trip (metadata JSON dict)
# ---------------------------------------------------------------------------
def test_put_and_get_document() -> None:
    doc = mem.KbDocument(
        id="doc-1", tenant_id=_TENANT_A, collection_id="kb-sales",
        document_id="doc-1", filename="manual.md",
        size_bytes=4096, chunk_count=12, status="indexed",
        metadata={"source": "upload", "author": "alice"},
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_document(_TENANT_A, doc)

    fetched = sql.get_document(_TENANT_A, "doc-1")
    assert fetched is not None
    assert fetched.collection_id == "kb-sales"
    assert fetched.filename == "manual.md"
    assert fetched.size_bytes == 4096
    assert fetched.chunk_count == 12
    assert fetched.status == "indexed"
    assert fetched.metadata == {"source": "upload", "author": "alice"}


def test_put_document_upsert() -> None:
    doc = mem.KbDocument(
        id="doc-2", tenant_id=_TENANT_A, filename="old.md",
        chunk_count=5, metadata={"error": "parse"},
    )
    sql.put_document(_TENANT_A, doc)
    doc = mem.KbDocument(
        id="doc-2", tenant_id=_TENANT_A, filename="new.md",
        chunk_count=10, status="failed",
        metadata={"error": "parse", "retry": 3},
    )
    sql.put_document(_TENANT_A, doc)

    fetched = sql.get_document(_TENANT_A, "doc-2")
    assert fetched is not None
    assert fetched.filename == "new.md"
    assert fetched.chunk_count == 10
    assert fetched.status == "failed"
    assert fetched.metadata == {"error": "parse", "retry": 3}


def test_delete_document() -> None:
    sql.put_document(_TENANT_A, mem.KbDocument(id="doc-del", tenant_id=_TENANT_A, filename="d"))
    assert sql.delete_document(_TENANT_A, "doc-del") is True
    assert sql.get_document(_TENANT_A, "doc-del") is None


def test_delete_document_rejects_cross_tenant() -> None:
    sql.put_document(_TENANT_A, mem.KbDocument(id="doc-x", tenant_id=_TENANT_A, filename="x"))
    assert sql.delete_document(_TENANT_B, "doc-x") is False


# ---------------------------------------------------------------------------
# KbSearchLog round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_search_log() -> None:
    log = mem.KbSearchLog(
        id="log-1", tenant_id=_TENANT_A, query="sales trend Q3",
        mode="hybrid", total_hits=5, latency_ms=120,
        created_at="2026-08-01T00:00:00Z",
    )
    sql.put_search_log(_TENANT_A, log)

    fetched = sql.get_search_log(_TENANT_A, "log-1")
    assert fetched is not None
    assert fetched.query == "sales trend Q3"
    assert fetched.mode == "hybrid"
    assert fetched.total_hits == 5
    assert fetched.latency_ms == 120


def test_delete_search_log() -> None:
    sql.put_search_log(_TENANT_A, mem.KbSearchLog(id="log-del", tenant_id=_TENANT_A, query="q"))
    assert sql.delete_search_log(_TENANT_A, "log-del") is True
    assert sql.get_search_log(_TENANT_A, "log-del") is None


def test_delete_search_log_rejects_cross_tenant() -> None:
    sql.put_search_log(_TENANT_A, mem.KbSearchLog(id="log-x", tenant_id=_TENANT_A, query="q"))
    assert sql.delete_search_log(_TENANT_B, "log-x") is False


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def test_tenant_isolation() -> None:
    sql.put_collection(_TENANT_A, mem.KbCollection(id="kb-a", tenant_id=_TENANT_A, name="a"))
    sql.put_collection(_TENANT_B, mem.KbCollection(id="kb-b", tenant_id=_TENANT_B, name="b"))

    a_cols = sql.list_collections(_TENANT_A)
    assert [c.id for c in a_cols] == ["kb-a"]

    b_cols = sql.list_collections(_TENANT_B)
    assert [c.id for c in b_cols] == ["kb-b"]

    assert sql.get_collection(_TENANT_B, "kb-a") is None
    assert sql.get_collection(_TENANT_A, "kb-b") is None


def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_collections("") == []
    assert sql.list_documents("") == []
    assert sql.list_search_logs("") == []
    assert sql.get_collection("", "kb-1") is None
    assert sql.get_document("", "doc-1") is None
    assert sql.get_search_log("", "log-1") is None


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["collections"] >= 3
    assert counts["documents"] >= 3
    assert counts["search_logs"] >= 2
    assert len(sql.list_collections(_TENANT_A)) >= 3
    assert len(sql.list_documents(_TENANT_A)) >= 3
    assert len(sql.list_search_logs(_TENANT_A)) >= 2
    assert sql.list_collections(_TENANT_B) == []
