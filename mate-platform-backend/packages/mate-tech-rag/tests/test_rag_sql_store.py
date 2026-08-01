"""Tests for mate_tech_rag.repositories.sql_store — SQL persistence (P3-W4).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation.
"""
from __future__ import annotations

import pytest

from mate_tech_db.base import Base, create_all, init_engine, reset_engine
from mate_tech_rag.repositories import in_memory as mem
from mate_tech_rag.repositories import sql_models as models  # noqa: F401
from mate_tech_rag.repositories import sql_store as sql


@pytest.fixture(autouse=True)
def _fresh_db() -> None:
    reset_engine()
    init_engine("sqlite:///:memory:")
    create_all()
    yield
    reset_engine()


_TENANT_A = "tenant-acme"
_TENANT_B = "tenant-bigo"


# ---------------------------------------------------------------------------
# RagDocument round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_document() -> None:
    doc = mem.RagDocument(
        id="doc-1", tenant_id=_TENANT_A, document_id="doc-1",
        filename="manual.md", chunk_count=12,
        metadata={"source": "upload"}, status="indexed",
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z",
    )
    sql.put_document(_TENANT_A, doc)

    fetched = sql.get_document(_TENANT_A, "doc-1")
    assert fetched is not None
    assert fetched.id == "doc-1"
    assert fetched.document_id == "doc-1"
    assert fetched.filename == "manual.md"
    assert fetched.chunk_count == 12
    assert fetched.metadata == {"source": "upload"}
    assert fetched.status == "indexed"


def test_put_document_upsert() -> None:
    doc = mem.RagDocument(
        id="doc-2", tenant_id=_TENANT_A, document_id="doc-2",
        filename="old.md", chunk_count=5,
    )
    sql.put_document(_TENANT_A, doc)
    doc = mem.RagDocument(
        id="doc-2", tenant_id=_TENANT_A, document_id="doc-2",
        filename="new.md", chunk_count=10, status="failed",
        metadata={"error": "parse"},
    )
    sql.put_document(_TENANT_A, doc)

    fetched = sql.get_document(_TENANT_A, "doc-2")
    assert fetched is not None
    assert fetched.filename == "new.md"
    assert fetched.chunk_count == 10
    assert fetched.status == "failed"
    assert fetched.metadata == {"error": "parse"}


def test_delete_document() -> None:
    sql.put_document(_TENANT_A, mem.RagDocument(
        id="doc-del", tenant_id=_TENANT_A, document_id="doc-del",
    ))
    assert sql.delete_document(_TENANT_A, "doc-del") is True
    assert sql.get_document(_TENANT_A, "doc-del") is None
    assert sql.delete_document(_TENANT_A, "doc-del") is False


def test_delete_document_rejects_cross_tenant() -> None:
    sql.put_document(_TENANT_A, mem.RagDocument(
        id="doc-x", tenant_id=_TENANT_A, document_id="doc-x",
    ))
    assert sql.delete_document(_TENANT_B, "doc-x") is False
    assert sql.get_document(_TENANT_A, "doc-x") is not None


# ---------------------------------------------------------------------------
# RagIndex round-trip
# ---------------------------------------------------------------------------
def test_put_and_get_index() -> None:
    idx = mem.RagIndex(
        id="idx-1", tenant_id=_TENANT_A, name="hybrid",
        backend="milvus", chunk_count=100, status="active",
    )
    sql.put_index(_TENANT_A, idx)

    fetched = sql.get_index(_TENANT_A, "idx-1")
    assert fetched is not None
    assert fetched.name == "hybrid"
    assert fetched.backend == "milvus"
    assert fetched.chunk_count == 100
    assert fetched.status == "active"


def test_delete_index() -> None:
    sql.put_index(_TENANT_A, mem.RagIndex(
        id="idx-del", tenant_id=_TENANT_A, name="temp",
    ))
    assert sql.delete_index(_TENANT_A, "idx-del") is True
    assert sql.get_index(_TENANT_A, "idx-del") is None


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------
def test_tenant_isolation() -> None:
    sql.put_document(_TENANT_A, mem.RagDocument(
        id="doc-a", tenant_id=_TENANT_A, document_id="doc-a",
    ))
    sql.put_document(_TENANT_B, mem.RagDocument(
        id="doc-b", tenant_id=_TENANT_B, document_id="doc-b",
    ))

    a_docs = sql.list_documents(_TENANT_A)
    assert [d.id for d in a_docs] == ["doc-a"]

    b_docs = sql.list_documents(_TENANT_B)
    assert [d.id for d in b_docs] == ["doc-b"]

    assert sql.get_document(_TENANT_B, "doc-a") is None
    assert sql.get_document(_TENANT_A, "doc-b") is None


def test_anonymous_tenant_returns_empty() -> None:
    assert sql.list_documents("") == []
    assert sql.list_indexes("") == []
    assert sql.get_document("", "doc-1") is None
    assert sql.get_index("", "idx-1") is None


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def test_seed_from_inmemory() -> None:
    counts = sql.seed_from_inmemory(_TENANT_A)
    assert counts["documents"] >= 3
    assert counts["indexes"] >= 3
    assert len(sql.list_documents(_TENANT_A)) >= 3
    assert len(sql.list_indexes(_TENANT_A)) >= 3
    assert sql.list_documents(_TENANT_B) == []
