"""Tests for mate_app_kb.repositories.sql_store — SQL persistence (P3-W4).

Uses SQLite in-memory + Base.metadata.create_all to verify the SQL
store's CRUD + tenant isolation + JSON serialisation (config, metadata),
plus the retrieval-config + snapshot surface (defaults-on-first-get,
upsert, FIFO cap, in_memory semantic parity).
"""
from __future__ import annotations

import pytest
from sqlalchemy import select

from mate_app_kb.repositories import in_memory as mem
from mate_app_kb.repositories import sql_models as models
from mate_app_kb.repositories import sql_store as sql
from mate_tech_db.base import create_all, init_engine, reset_engine


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


# ---------------------------------------------------------------------------
# Retrieval config — get / put (in_memory semantic parity)
# ---------------------------------------------------------------------------
def test_get_retrieval_config_defaults_on_first_access() -> None:
    """A missing tenant gets the default config, materialised as a row.

    Parity with in_memory: version=1 + blank updated_at mark a
    never-user-saved config (the API version logic depends on both).
    """
    cfg = sql.get_retrieval_config(_TENANT_A)
    assert cfg == mem.KbRetrievalConfig(tenant_id=_TENANT_A)
    assert cfg.version == 1
    assert cfg.updated_at == ""
    # The default row is persisted — a fresh read returns the same state.
    assert sql.get_retrieval_config(_TENANT_A) == cfg


def test_put_then_get_retrieval_config_round_trips() -> None:
    cfg = mem.KbRetrievalConfig(
        tenant_id=_TENANT_A, mode="FACTUAL", rerank_strategy="keyword",
        top_k=5, similarity_threshold=0.25, chunk_strategy="semantic",
        chunk_size=256, chunk_overlap=32, vector_weight=0.6,
        keyword_weight=0.4, reranker_enabled=False, show_citations=False,
        version=7, updated_at="2026-08-16T00:00:00Z",
    )
    assert sql.put_retrieval_config(_TENANT_A, cfg) == cfg
    assert sql.get_retrieval_config(_TENANT_A) == cfg


def test_put_retrieval_config_upsert_overwrites() -> None:
    sql.put_retrieval_config(_TENANT_A, mem.KbRetrievalConfig(
        tenant_id=_TENANT_A, rerank_strategy="keyword", version=2,
        updated_at="2026-08-16T00:00:00Z",
    ))
    sql.put_retrieval_config(_TENANT_A, mem.KbRetrievalConfig(
        tenant_id=_TENANT_A, rerank_strategy="length", top_k=3,
        show_citations=False, version=3, updated_at="2026-08-16T01:00:00Z",
    ))
    got = sql.get_retrieval_config(_TENANT_A)
    assert got.rerank_strategy == "length"
    assert got.top_k == 3
    assert got.show_citations is False
    assert got.version == 3


def test_retrieval_config_cross_tenant_isolation() -> None:
    sql.put_retrieval_config(_TENANT_A, mem.KbRetrievalConfig(
        tenant_id=_TENANT_A, rerank_strategy="keyword", version=2,
        updated_at="2026-08-16T00:00:00Z",
    ))
    b = sql.get_retrieval_config(_TENANT_B)
    assert b.tenant_id == _TENANT_B
    assert b.rerank_strategy == "identity"  # its own defaults
    assert b.version == 1
    assert sql.get_retrieval_config(_TENANT_A).rerank_strategy == "keyword"


def test_retrieval_config_anonymous_tenant_is_transient() -> None:
    """Empty tenant_id mirrors in_memory: defaults returned, nothing stored."""
    assert sql.get_retrieval_config("") == mem.KbRetrievalConfig(tenant_id="")
    cfg = mem.KbRetrievalConfig(tenant_id="", rerank_strategy="keyword")
    assert sql.put_retrieval_config("", cfg) == cfg
    snap = mem.KbRetrievalConfigSnapshot(id=":1", tenant_id="", version=1)
    assert sql.put_retrieval_config_snapshot("", snap) == snap
    assert sql.list_retrieval_config_snapshots("") == []
    # Nothing leaked into the tables.
    s = sql._session()
    assert s.execute(select(models.KbRetrievalConfigORM)).scalars().first() is None
    assert s.execute(select(models.KbRetrievalConfigSnapshotORM)).scalars().first() is None


def test_seed_from_inmemory_does_not_seed_retrieval_config() -> None:
    """The SQL bootstrap never writes config/snapshot rows — a tenant's
    saved config cannot be clobbered by (re)seeding (create_app calls
    seed_from_inmemory on every start under KB_STORE=sql)."""
    sql.put_retrieval_config(_TENANT_A, mem.KbRetrievalConfig(
        tenant_id=_TENANT_A, rerank_strategy="keyword", version=4,
        updated_at="2026-08-16T00:00:00Z",
    ))
    sql.seed_from_inmemory(_TENANT_A)
    # Saved config untouched; other tenants still have no rows.
    assert sql.get_retrieval_config(_TENANT_A).rerank_strategy == "keyword"
    s = sql._session()
    assert s.execute(
        select(models.KbRetrievalConfigORM).where(
            models.KbRetrievalConfigORM.tenant_id == _TENANT_B
        )
    ).scalars().first() is None
    assert s.execute(select(models.KbRetrievalConfigSnapshotORM)).scalars().first() is None


# ---------------------------------------------------------------------------
# Retrieval config — snapshots (P1.8 history, FIFO cap 10)
# ---------------------------------------------------------------------------
def _snap(version: int, tenant: str = _TENANT_A) -> mem.KbRetrievalConfigSnapshot:
    return mem.KbRetrievalConfigSnapshot(
        id=f"{tenant}:{version}", tenant_id=tenant, version=version,
        rerank_strategy=f"strategy-{version}", snapshot_at=f"2026-08-16T00:00:{version:02d}Z",
    )


def test_snapshot_round_trip() -> None:
    snap = mem.KbRetrievalConfigSnapshot(
        id=f"{_TENANT_A}:2", tenant_id=_TENANT_A, version=2,
        mode="FACTUAL", rerank_strategy="keyword", top_k=5,
        similarity_threshold=0.25, chunk_strategy="semantic", chunk_size=256,
        chunk_overlap=32, vector_weight=0.6, keyword_weight=0.4,
        reranker_enabled=False, show_citations=False,
        snapshot_at="2026-08-16T00:00:00Z",
    )
    assert sql.put_retrieval_config_snapshot(_TENANT_A, snap) == snap
    assert sql.list_retrieval_config_snapshots(_TENANT_A) == [snap]


def test_snapshots_fifo_cap_10_keeps_newest() -> None:
    for v in range(1, 13):  # 12 snapshots — 2 over the cap
        sql.put_retrieval_config_snapshot(_TENANT_A, _snap(v))
    kept = sql.list_retrieval_config_snapshots(_TENANT_A)
    assert len(kept) == 10
    # Oldest two dropped; insertion order preserved (newest last).
    assert [s.version for s in kept] == list(range(3, 13))


def test_snapshots_limit_keeps_newest_tail() -> None:
    for v in range(1, 6):
        sql.put_retrieval_config_snapshot(_TENANT_A, _snap(v))
    limited = sql.list_retrieval_config_snapshots(_TENANT_A, limit=3)
    assert [s.version for s in limited] == [3, 4, 5]
    # in_memory parity: limit=0 still returns the single newest snapshot
    # (history[-max(1, int(limit)):]).
    assert [s.version for s in sql.list_retrieval_config_snapshots(_TENANT_A, limit=0)] == [5]


def test_snapshots_cross_tenant_isolation() -> None:
    sql.put_retrieval_config_snapshot(_TENANT_A, _snap(2))
    sql.put_retrieval_config_snapshot(_TENANT_B, _snap(9, tenant=_TENANT_B))
    a = sql.list_retrieval_config_snapshots(_TENANT_A)
    b = sql.list_retrieval_config_snapshots(_TENANT_B)
    assert [s.id for s in a] == [f"{_TENANT_A}:2"]
    assert [s.id for s in b] == [f"{_TENANT_B}:9"]


def test_snapshot_reput_same_id_refreshes_in_place() -> None:
    """The {tenant}:{version} PK makes a re-put an in-place refresh (the
    API never re-snapshots a version; this pins the SQL-side behaviour)."""
    sql.put_retrieval_config_snapshot(_TENANT_A, _snap(2))
    refreshed = mem.KbRetrievalConfigSnapshot(
        id=f"{_TENANT_A}:2", tenant_id=_TENANT_A, version=2,
        rerank_strategy="refreshed", snapshot_at="2026-08-16T09:00:00Z",
    )
    sql.put_retrieval_config_snapshot(_TENANT_A, refreshed)
    sql.put_retrieval_config_snapshot(_TENANT_A, _snap(3))
    kept = sql.list_retrieval_config_snapshots(_TENANT_A)
    assert len(kept) == 2
    assert kept[0].rerank_strategy == "refreshed"  # refreshed, original seq kept
    assert [s.version for s in kept] == [2, 3]
