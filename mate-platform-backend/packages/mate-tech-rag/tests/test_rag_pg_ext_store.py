"""Tests for the extended PG persistence layer (RAG_MODE=pg surfaces).

Covers ``storage/pg_ext_store.py`` and its wiring:

  * PgGraphRAGClient  — ENTITY retrieval persistence (rag_graph_edges)
  * PgLightRAGClient  — THEMATIC retrieval persistence (rag_lightrag_chunks)
  * PgKbDocumentStore — kb_id -> document_id membership (rag_kb_documents)
  * PgMetricsStore    — latency aggregate upserts (rag_metrics)
  * LatencyBucket pg_sink debounced flush + snapshot_merged math
  * create_clients() wiring under RAG_MODE=pg (incl. _pg_mode flag)
  * app-level kb registry routing (memory unchanged / pg -> PG store)
  * cascade delete kb-membership cleanup

PG is faked at the pool boundary (FakePool/FakeDb execute the handful of
statements the stores issue) so no server is needed; the memory-mode
behaviour is asserted to be completely unchanged.
"""
from __future__ import annotations

import json
import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

# --- module-level env setup (must precede app import) ----------------------
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag"):
    sys.path.insert(0, str(PKG / sub / "src"))

JWT_SECRET = "test-secret"


def _keycloak_token(*, tenant_id: str = "tenant-acme") -> str:
    now = int(time.time())
    roles = ["PLATFORM_SUPER_ADMIN"]
    return pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": roles},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": roles,
            "iat": now,
            "exp": now + 3600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


# ---------------------------------------------------------------------------
# Fake psycopg pool: a tiny interpreter for the statements pg_ext_store issues
# ---------------------------------------------------------------------------
class FakeDb:
    """In-memory stand-in for the four rag_* tables."""

    def __init__(self) -> None:
        self.rows: dict[str, list[dict[str, Any]]] = {
            "rag_graph_edges": [],
            "rag_lightrag_chunks": [],
        }
        self.next_id = {"rag_graph_edges": 0, "rag_lightrag_chunks": 0}
        self.kb: dict[tuple[str, str], str] = {}
        self.metrics: dict[str, list[float]] = {}
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    # -- helpers ----------------------------------------------------------
    @staticmethod
    def _token_table(sql_u: str) -> str:
        return "rag_graph_edges" if "RAG_GRAPH_EDGES" in sql_u else "rag_lightrag_chunks"

    def execute(self, sql: str, params: tuple[Any, ...]) -> tuple[list[tuple], int]:
        sql_norm = " ".join(sql.split())
        self.calls.append((sql_norm, params))
        u = sql_norm.upper()

        if u.startswith(("CREATE TABLE", "CREATE INDEX")):
            return [], 0

        # INSERT ... RETURNING id (graph / lightrag chunk tables).
        if u.startswith(("INSERT INTO RAG_GRAPH_EDGES", "INSERT INTO RAG_LIGHTRAG_CHUNKS")):
            table = self._token_table(u)
            document_id, text, meta_json, tokens, _ = params
            self.next_id[table] += 1
            rid = self.next_id[table]
            self.rows[table].append(
                {
                    "id": rid,
                    "document_id": document_id,
                    "text": text,
                    "metadata": json.loads(meta_json),
                    "tokens": set(str(tokens).split()),
                }
            )
            return [(rid,)], 1

        # BM25-ish search (rank = query-token overlap count).
        # OR-tsquery shape: params = (tok…, tok…, limit) — the token list is
        # bound twice (match + rank expr) then LIMIT. Tokens may also arrive
        # as the legacy plainto shape (tokens, tokens, limit).
        if "TS_RANK" in u:
            table = self._token_table(u)
            if "TO_TSQUERY" in u:
                n_toks = (len(params) - 1) // 2
                q_tokens = set(str(p) for p in params[:n_toks])
                limit = int(params[-1])
            else:
                q_tokens = set(str(params[0]).split())
                limit = int(params[2])
            scored = [
                (float(len(r["tokens"] & q_tokens)), r)
                for r in self.rows[table]
                if r["tokens"] & q_tokens
            ]
            scored.sort(key=lambda t: t[0], reverse=True)
            return (
                [(r["id"], r["document_id"], r["text"], r["metadata"], ov) for ov, r in scored[:limit]],
                len(scored),
            )

        if "COUNT(*)" in u:
            table = self._token_table(u)
            return [(len(self.rows[table]),)], 1

        # kb membership -----------------------------------------------------
        if u.startswith("INSERT INTO RAG_KB_DOCUMENTS"):
            kb_id, document_id, tenant_id = params
            self.kb[(kb_id, document_id)] = tenant_id
            return [], 1
        if u.startswith("SELECT DOCUMENT_ID FROM RAG_KB_DOCUMENTS"):
            kb_id = params[0]
            return [(d,) for (k, d) in sorted(self.kb) if k == kb_id], 0
        if u.startswith("DELETE FROM RAG_KB_DOCUMENTS WHERE KB_ID"):
            kb_id, document_id = params
            return [], int(self.kb.pop((kb_id, document_id), None) is not None)
        if u.startswith("DELETE FROM RAG_KB_DOCUMENTS WHERE DOCUMENT_ID"):
            document_id = params[0]
            doomed = [k for k in self.kb if k[1] == document_id]
            for k in doomed:
                del self.kb[k]
            return [], len(doomed)
        if u.startswith("DELETE FROM RAG_KB_DOCUMENTS"):
            removed = len(self.kb)
            self.kb.clear()
            return [], removed

        # metrics -----------------------------------------------------------
        if u.startswith("INSERT INTO RAG_METRICS"):
            endpoint, count_delta, sum_delta, p95 = params
            cur = self.metrics.setdefault(endpoint, [0, 0.0, 0.0])
            cur[0] += int(count_delta)
            cur[1] += float(sum_delta)
            cur[2] = float(p95)
            return [], 1
        if u.startswith("SELECT ENDPOINT"):
            return (
                [(ep, v[0], v[1], v[2], "2026-08-16T00:00:00+00:00") for ep, v in self.metrics.items()],
                0,
            )
        if u.startswith("DELETE FROM RAG_METRICS"):
            removed = len(self.metrics)
            self.metrics.clear()
            return [], removed

        # DELETE ... WHERE document_id (graph / lightrag tables).
        if u.startswith(("DELETE FROM RAG_GRAPH_EDGES", "DELETE FROM RAG_LIGHTRAG_CHUNKS")):
            table = self._token_table(u)
            document_id = params[0]
            doomed = [r for r in self.rows[table] if r["document_id"] == document_id]
            self.rows[table] = [r for r in self.rows[table] if r["document_id"] != document_id]
            return [], len(doomed)

        raise AssertionError(f"FakeDb: unhandled SQL: {sql_norm}")


class FakeCursor:
    def __init__(self, db: FakeDb) -> None:
        self._db = db
        self._results: list[tuple] = []
        self.rowcount = 0

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        self._results, self.rowcount = self._db.execute(sql, params)

    def fetchone(self) -> tuple | None:
        return self._results[0] if self._results else None

    def fetchall(self) -> list[tuple]:
        return list(self._results)

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *exc: Any) -> None:
        return None


class FakeConnection:
    def __init__(self, db: FakeDb) -> None:
        self._db = db

    def cursor(self) -> FakeCursor:
        return FakeCursor(self._db)

    def commit(self) -> None:
        return None

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, *exc: Any) -> None:
        return None


class FakePool:
    """Mimics psycopg_pool.ConnectionPool's ``connection()`` CM surface."""

    def __init__(self) -> None:
        self.db = FakeDb()

    def connection(self) -> FakeConnection:
        return FakeConnection(self.db)

    def close(self) -> None:
        return None


# ---------------------------------------------------------------------------
# 0. CJK tokenizer copy
# ---------------------------------------------------------------------------
class TestCjkTokensCopy:
    def test_chinese_becomes_bigrams(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import _cjk_tokens

        assert _cjk_tokens("数据平台") == "数据 据平 平台"

    def test_latin_lowercased_and_cjk_mixed(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import _cjk_tokens

        out = _cjk_tokens("GraphRAG 图检索")
        assert "graphrag" in out
        assert "图检" in out and "检索" in out

    def test_lone_ideograph_is_unigram(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import _cjk_tokens

        assert _cjk_tokens("图") == "图"


# ---------------------------------------------------------------------------
# 1. PgGraphRAGClient (ENTITY)
# ---------------------------------------------------------------------------
class TestPgGraphRAGClient:
    def test_insert_query_count_delete_roundtrip(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient

        pool = FakePool()
        client = PgGraphRAGClient(pool=pool)
        assert client.is_available()

        cid = client.insert("张三负责数据平台建设", "doc-1", {"source": "upload"})
        assert cid.startswith("gedge-")
        assert client.count() == 1

        hits = client.query("张三 数据平台", top_k=5)
        assert len(hits) == 1
        hit = hits[0]
        assert hit.chunk_id == cid
        assert hit.document_id == "doc-1"
        assert hit.metadata["mode"] == "ENTITY"
        assert hit.metadata["source"] == "upload"
        assert 0.0 < hit.score <= 1.0
        assert "张三" in hit.text

        removed = client.delete_by_document("doc-1")
        assert removed == 1
        assert client.count() == 0
        assert client.query("张三 数据平台", top_k=5) == []

    def test_query_ranks_by_token_overlap(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient

        pool = FakePool()
        client = PgGraphRAGClient(pool=pool)
        client.insert("张三负责数据平台建设", "doc-strong", None)
        client.insert("无关内容另一篇", "doc-weak", None)
        hits = client.query("数据平台 张三", top_k=5)
        assert hits
        assert hits[0].document_id == "doc-strong"
        assert hits[0].score >= hits[-1].score

    def test_query_no_token_overlap_returns_empty(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient

        pool = FakePool()
        client = PgGraphRAGClient(pool=pool)
        client.insert("张三负责数据平台建设", "doc-1", None)
        assert client.query("completely unrelated latin", top_k=5) == []

    def test_search_alias_matches_query(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient

        client = PgGraphRAGClient(pool=FakePool())
        client.insert("实体图测试", "doc-1", None)
        assert client.search("实体图", top_k=3) == client.query("实体图", top_k=3)

    def test_top_k_is_respected(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient

        client = PgGraphRAGClient(pool=FakePool())
        for i in range(5):
            client.insert(f"共享关键词内容第{i}段", f"doc-{i}", None)
        assert len(client.query("共享关键词", top_k=3)) == 3

    def test_unavailable_pool_is_graceful_noop(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient

        client = PgGraphRAGClient(pool=None, dsn=None)
        assert not client.is_available()
        assert client.insert("x", "d", None) == ""
        assert client.query("x", 5) == []
        assert client.count() == 0
        assert client.delete_by_document("d") == 0

    def test_graph_strategy_integration(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient
        from mate_tech_rag.strategies.base import GraphStrategy

        client = PgGraphRAGClient(pool=FakePool())
        client.insert("张三负责数据平台建设", "doc-1", None)
        result = GraphStrategy(client).search("张三", top_k=5)
        assert result.hits
        assert result.hits[0].metadata["mode"] == "ENTITY"
        assert result.latency_ms >= 0


# ---------------------------------------------------------------------------
# 2. PgLightRAGClient (THEMATIC)
# ---------------------------------------------------------------------------
class TestPgLightRAGClient:
    def test_insert_query_count_delete_roundtrip(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgLightRAGClient

        pool = FakePool()
        client = PgLightRAGClient(pool=pool)
        cid = client.insert("数据治理主题的段落", "doc-t1", {"topic": "gov"})
        assert cid.startswith("lrag-")
        assert client.count() == 1

        hits = client.query("数据治理", top_k=5)
        assert len(hits) == 1
        assert hits[0].chunk_id == cid
        assert hits[0].metadata["mode"] == "THEMATIC"
        assert hits[0].metadata["topic"] == "gov"

        assert client.delete_by_document("doc-t1") == 1
        assert client.count() == 0

    def test_isolated_from_graph_table(self) -> None:
        """graph and lightrag rows must live in separate tables."""
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient, PgLightRAGClient

        pool = FakePool()
        graph = PgGraphRAGClient(pool=pool)
        lightrag = PgLightRAGClient(pool=pool)
        graph.insert("共享文本内容", "doc-x", None)
        assert lightrag.count() == 0
        assert graph.count() == 1

    def test_thematic_strategy_integration(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgLightRAGClient
        from mate_tech_rag.strategies.base import ThematicStrategy

        client = PgLightRAGClient(pool=FakePool())
        client.insert("数据治理主题的段落", "doc-t1", None)
        result = ThematicStrategy(client).search("数据治理", top_k=5)
        assert result.hits
        assert result.hits[0].metadata["mode"] == "THEMATIC"


# ---------------------------------------------------------------------------
# 3. PgKbDocumentStore
# ---------------------------------------------------------------------------
class TestPgKbDocumentStore:
    def test_register_list_sorted(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgKbDocumentStore

        store = PgKbDocumentStore(pool=FakePool())
        assert store.register("kb-1", "doc-b", "tenant-a")
        assert store.register("kb-1", "doc-a", "tenant-a")
        assert store.list_documents("kb-1") == ["doc-a", "doc-b"]
        assert store.list_documents("kb-other") == []

    def test_register_is_idempotent_upsert(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgKbDocumentStore

        store = PgKbDocumentStore(pool=FakePool())
        store.register("kb-1", "doc-1", "tenant-a")
        store.register("kb-1", "doc-1", "tenant-b")  # tenant update, not a dup row
        assert store.list_documents("kb-1") == ["doc-1"]

    def test_unregister_and_delete_by_document(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgKbDocumentStore

        store = PgKbDocumentStore(pool=FakePool())
        store.register("kb-1", "doc-1", "t")
        store.register("kb-1", "doc-2", "t")
        store.register("kb-2", "doc-1", "t")
        assert store.unregister("kb-1", "doc-1") == 1
        assert store.list_documents("kb-1") == ["doc-2"]
        assert store.delete_by_document("doc-1") == 1
        assert store.list_documents("kb-2") == []
        assert store.delete_by_document("doc-missing") == 0

    def test_clear(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgKbDocumentStore

        store = PgKbDocumentStore(pool=FakePool())
        store.register("kb-1", "doc-1", "t")
        store.register("kb-2", "doc-2", "t")
        assert store.clear() == 2
        assert store.list_documents("kb-1") == []


# ---------------------------------------------------------------------------
# 4. PgMetricsStore
# ---------------------------------------------------------------------------
class TestPgMetricsStore:
    def test_upsert_accumulates(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgMetricsStore

        store = PgMetricsStore(pool=FakePool())
        assert store.upsert("search", 10, 250.0, 30.0)
        assert store.upsert("search", 10, 150.0, 44.0)
        all_rows = store.load_all()
        assert all_rows["search"]["count"] == 20
        assert all_rows["search"]["sum_ms"] == pytest.approx(400.0)
        assert all_rows["search"]["p95_last"] == pytest.approx(44.0)

    def test_delete_all(self) -> None:
        from mate_tech_rag.storage.pg_ext_store import PgMetricsStore

        store = PgMetricsStore(pool=FakePool())
        store.upsert("ingest", 1, 10.0, 10.0)
        assert store.delete_all() == 1
        assert store.load_all() == {}


# ---------------------------------------------------------------------------
# 5. LatencyBucket pg_sink debounced flush
# ---------------------------------------------------------------------------
class RecordingSink:
    def __init__(self, ok: bool = True) -> None:
        self.calls: list[tuple[str, int, float, float]] = []
        self._ok = ok

    def upsert(self, endpoint: str, count: int, sum_ms: float, p95_last: float) -> bool:
        self.calls.append((endpoint, count, sum_ms, p95_last))
        return self._ok


class TestLatencyBucketPgFlush:
    def test_memory_mode_unchanged_without_sink(self) -> None:
        from mate_tech_rag.api.metrics import LatencyBucket

        bucket = LatencyBucket(name="search")
        for i in range(10):
            bucket.observe(float(i))
        snap = bucket.snapshot()
        assert snap["count"] == 10
        assert snap["sum_ms"] == pytest.approx(45.0)
        assert snap["avg_ms"] == pytest.approx(4.5)
        assert snap["last_latency_ms"] == 9.0
        # snapshot_merged with no pg row is identical.
        assert bucket.snapshot_merged(None) == snap

    def test_flush_every_10_observes(self) -> None:
        from mate_tech_rag.api.metrics import LatencyBucket

        sink = RecordingSink()
        bucket = LatencyBucket(name="search", pg_sink=sink, flush_every=10)
        for i in range(9):
            bucket.observe(float(i))
        assert sink.calls == []
        bucket.observe(9.0)  # 10th observe triggers the flush
        assert len(sink.calls) == 1
        endpoint, count, sum_ms, _p95 = sink.calls[0]
        assert endpoint == "search"
        assert count == 10
        assert sum_ms == pytest.approx(45.0)
        assert 0.0 <= _p95 <= 9.0

    def test_snapshot_merged_combines_pg_and_unflushed(self) -> None:
        from mate_tech_rag.api.metrics import LatencyBucket

        sink = RecordingSink()
        bucket = LatencyBucket(name="search", pg_sink=sink, flush_every=10)
        for i in range(10):
            bucket.observe(float(i))  # flush -> PG has 10
        for i in range(3):
            bucket.observe(100.0)  # 3 unflushed
        merged = bucket.snapshot_merged({"count": 10, "sum_ms": 45.0, "p95_last": 8.0})
        assert merged["count"] == 13
        assert merged["sum_ms"] == pytest.approx(345.0)
        assert merged["avg_ms"] == pytest.approx(345.0 / 13)

    def test_failed_flush_retains_delta_and_retries(self) -> None:
        from mate_tech_rag.api.metrics import LatencyBucket

        sink = RecordingSink(ok=False)
        bucket = LatencyBucket(name="search", pg_sink=sink, flush_every=10)
        for i in range(10):
            bucket.observe(float(i))
        assert len(sink.calls) == 1
        # The failed flush must NOT drop the delta.
        merged = bucket.snapshot_merged({"count": 5, "sum_ms": 20.0, "p95_last": 1.0})
        assert merged["count"] == 15
        # The next observe re-attempts with 11 accumulated.
        bucket.observe(0.0)
        assert len(sink.calls) == 2
        assert sink.calls[1][1] == 11

    def test_p95_falls_back_to_pg_on_empty_window(self) -> None:
        from mate_tech_rag.api.metrics import LatencyBucket

        bucket = LatencyBucket(name="ingest")  # fresh process, no observes
        merged = bucket.snapshot_merged({"count": 7, "sum_ms": 700.0, "p95_last": 120.0})
        assert merged["count"] == 7
        assert merged["avg_ms"] == pytest.approx(100.0)
        assert merged["p95_recent"] == pytest.approx(120.0)

    def test_make_default_buckets_default_has_no_sink(self) -> None:
        from mate_tech_rag.api.metrics import make_default_buckets

        buckets = make_default_buckets()
        assert set(buckets) == {"ingest", "search", "upload"}
        for bucket in buckets.values():
            assert bucket.pg_sink is None

    def test_reset_clears_unflushed_deltas(self) -> None:
        from mate_tech_rag.api.metrics import LatencyBucket

        bucket = LatencyBucket(name="search", pg_sink=RecordingSink(ok=False), flush_every=10)
        for i in range(5):
            bucket.observe(float(i))
        bucket.reset()
        merged = bucket.snapshot_merged({"count": 0, "sum_ms": 0.0, "p95_last": 0.0})
        assert merged["count"] == 0


# ---------------------------------------------------------------------------
# 6. create_clients() wiring under RAG_MODE=pg
# ---------------------------------------------------------------------------
class FakePGClientForWiring:
    def __init__(self, dsn: str | None = None, available: bool = True) -> None:
        self._available = available

    def is_available(self) -> bool:
        return self._available

    def list_documents(self) -> list[dict[str, Any]]:
        return []


class TestCreateClientsPgWiring:
    def _restore(self, retrieval, saved) -> None:
        (
            retrieval._hybrid, retrieval._graph, retrieval._lightrag,
            retrieval._pg_client, retrieval._pg_store, retrieval._pg_mode,
        ) = saved

    def test_pg_mode_wires_graph_and_lightrag(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import mate_tech_rag.api.retrieval as retrieval
        import mate_tech_rag.storage.pg_ext_store as pg_ext_store
        from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient, PgLightRAGClient

        saved = (
            retrieval._hybrid, retrieval._graph, retrieval._lightrag,
            retrieval._pg_client, retrieval._pg_store, retrieval._pg_mode,
        )
        pool = FakePool()
        monkeypatch.setattr(retrieval, "PGClient", FakePGClientForWiring)
        monkeypatch.setattr(pg_ext_store, "get_shared_pool", lambda dsn=None: pool)
        monkeypatch.setenv("PG_DSN", "postgresql://fake:fake@localhost:5432/fakedb")
        monkeypatch.setenv("RAG_MODE", "pg")
        try:
            retrieval.create_clients()
            assert isinstance(retrieval._graph, PgGraphRAGClient)
            assert isinstance(retrieval._lightrag, PgLightRAGClient)
            assert retrieval._graph.is_available()
            assert retrieval._lightrag.is_available()
            assert retrieval.is_pg_mode() is True
            # The wired clients share the pg_ext_store pool (faked here).
            retrieval._graph.insert("接线测试图", "doc-wire", None)
            assert retrieval._graph.count() == 1
            assert retrieval._lightrag.count() == 0
        finally:
            self._restore(retrieval, saved)

    def test_pg_mode_requires_reachable_pg(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import mate_tech_rag.api.retrieval as retrieval

        saved = (
            retrieval._hybrid, retrieval._graph, retrieval._lightrag,
            retrieval._pg_client, retrieval._pg_store, retrieval._pg_mode,
        )
        monkeypatch.setattr(retrieval, "PGClient", FakePGClientForWiring)
        monkeypatch.setenv("PG_DSN", "postgresql://fake:fake@localhost:5432/fakedb")
        monkeypatch.setenv("RAG_MODE", "pg")
        try:
            with pytest.raises(RuntimeError, match="RAG_MODE=pg requires a reachable PG_DSN"):
                retrieval.create_clients()
            assert retrieval.is_pg_mode() is False
        finally:
            self._restore(retrieval, saved)

    def test_memory_mode_leaves_pg_mode_flag_false(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import mate_tech_rag.api.retrieval as retrieval

        saved = (
            retrieval._hybrid, retrieval._graph, retrieval._lightrag,
            retrieval._pg_client, retrieval._pg_store, retrieval._pg_mode,
        )
        monkeypatch.delenv("PG_DSN", raising=False)
        monkeypatch.delenv("RAG_MODE", raising=False)
        retrieval._pg_mode = True  # simulate a previous pg-mode run
        try:
            retrieval.create_clients()
            assert retrieval.is_pg_mode() is False
        finally:
            self._restore(retrieval, saved)


# ---------------------------------------------------------------------------
# 7. app-level kb registry routing
# ---------------------------------------------------------------------------
class FakeKbStore:
    """Recorder matching the PgKbDocumentStore surface used by app.py."""

    def __init__(self) -> None:
        self.docs: dict[str, set[str]] = {}
        self.registered: list[tuple[str, str, str]] = []
        self.unregistered: list[tuple[str, str]] = []
        self.cleared = 0

    def is_available(self) -> bool:
        return True

    def register(self, kb_id: str, document_id: str, tenant_id: str = "default") -> bool:
        self.registered.append((kb_id, document_id, tenant_id))
        self.docs.setdefault(kb_id, set()).add(document_id)
        return True

    def unregister(self, kb_id: str, document_id: str) -> int:
        self.unregistered.append((kb_id, document_id))
        self.docs.get(kb_id, set()).discard(document_id)
        return 1

    def list_documents(self, kb_id: str) -> list[str]:
        return sorted(self.docs.get(kb_id, set()))

    def delete_by_document(self, document_id: str) -> int:
        removed = 0
        for ids in self.docs.values():
            if document_id in ids:
                ids.discard(document_id)
                removed += 1
        return removed

    def clear(self) -> int:
        self.cleared += 1
        self.docs.clear()
        return 0


class TestAppKbRegistryRouting:
    def test_memory_mode_uses_dict_unchanged(self) -> None:
        import mate_tech_rag.api.app as app_module

        assert app_module.is_pg_mode() is False
        app_module.reset_kb_documents()
        app_module.register_kb_document("kb-m", "doc-2")
        app_module.register_kb_document("kb-m", "doc-1")
        assert app_module.list_kb_documents("kb-m") == ["doc-1", "doc-2"]
        app_module.unregister_kb_document("kb-m", "doc-1")
        assert app_module.list_kb_documents("kb-m") == ["doc-2"]
        app_module.reset_kb_documents()
        assert app_module.list_kb_documents("kb-m") == []

    def test_pg_mode_routes_to_pg_store(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import mate_tech_rag.api.app as app_module

        fake = FakeKbStore()
        monkeypatch.setattr(app_module, "is_pg_mode", lambda: True)
        monkeypatch.setattr(app_module, "get_kb_document_store", lambda: fake)
        try:
            app_module.register_kb_document("kb-p", "doc-9", tenant_id="tenant-x")
            assert fake.registered == [("kb-p", "doc-9", "tenant-x")]
            fake.register("kb-p", "doc-1", "tenant-x")
            assert app_module.list_kb_documents("kb-p") == ["doc-1", "doc-9"]
            app_module.unregister_kb_document("kb-p", "doc-1")
            assert fake.unregistered == [("kb-p", "doc-1")]
            app_module.reset_kb_documents()
            assert fake.cleared == 1
        finally:
            # The module-level dict must not have been touched by the pg path.
            assert "kb-p" not in app_module._kb_documents

    def test_pg_mode_pg_failure_does_not_touch_memory(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import mate_tech_rag.api.app as app_module

        class ExplodingStore(FakeKbStore):
            def register(self, kb_id, document_id, tenant_id="default"):
                raise RuntimeError("pg down")

            def list_documents(self, kb_id):
                raise RuntimeError("pg down")

        monkeypatch.setattr(app_module, "is_pg_mode", lambda: True)
        monkeypatch.setattr(app_module, "get_kb_document_store", lambda: ExplodingStore())
        app_module.reset_kb_documents()
        try:
            app_module.register_kb_document("kb-bad", "doc-1")
            assert app_module.list_kb_documents("kb-bad") == []
            assert app_module._kb_documents == {}
        finally:
            app_module.reset_kb_documents()


# ---------------------------------------------------------------------------
# 8. /metrics endpoint PG merge
# ---------------------------------------------------------------------------
class TestMetricsEndpointPgMerge:
    @pytest.fixture
    def rag_client(self) -> Iterator[TestClient]:
        from mate_tech_rag.api import app as app_module
        from mate_tech_rag.api.metrics import make_default_buckets

        app_module.app.state.metrics = make_default_buckets()
        yield TestClient(app_module.app)
        app_module.app.state.metrics = make_default_buckets()

    def test_metrics_endpoint_merges_pg_totals(
        self, rag_client: TestClient, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import mate_tech_rag.api.app as app_module

        class FakeMetricsStore:
            def is_available(self) -> bool:
                return True

            def load_all(self) -> dict[str, dict[str, Any]]:
                return {"search": {"count": 41, "sum_ms": 820.0, "p95_last": 39.0}}

        monkeypatch.setattr(app_module, "is_pg_mode", lambda: True)
        monkeypatch.setattr(app_module, "get_metrics_store", lambda: FakeMetricsStore())
        headers = {"Authorization": f"Bearer {_keycloak_token()}"}
        # Two in-process searches -> 2 unflushed observations merged on top
        # of the persisted totals.
        for _ in range(2):
            rag_client.post(
                "/api/v1/rag/search",
                json={"query": "pg merge test", "top_k": 3},
                headers=headers,
            )
        r = rag_client.get("/api/v1/rag/metrics", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["search"]["count"] == 41 + 2
        assert body["search"]["sum_ms"] >= 820.0
        # Buckets without a persisted row keep their plain snapshot.
        assert body["ingest"]["count"] == 0


# ---------------------------------------------------------------------------
# 9. cascade delete cleans kb membership (pg mode)
# ---------------------------------------------------------------------------
class TestPoolResurrection:
    def test_connection_failure_triggers_reconnect(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import mate_tech_rag.storage.pg_ext_store as pg_ext_store

        class DeadPool:
            def connection(self) -> None:
                raise RuntimeError("the pool 'pool-1' is already closed")

        good = FakePool()
        pools = [good]
        monkeypatch.setattr(pg_ext_store, "_POOLS", {"dsn-x": DeadPool()})
        monkeypatch.setattr(
            pg_ext_store, "get_shared_pool", lambda dsn=None: pools.pop(0),
        )
        client = pg_ext_store.PgGraphRAGClient(dsn="dsn-x")
        assert client.is_available()
        # First call hits the dead pool, degrades gracefully, reconnects.
        assert client.count() == 0
        assert client._pool is good
        # The resurrected store works again.
        client.insert("复活测试", "doc-r", None)
        assert client.count() == 1
        assert client.query("复活", top_k=3)

    def test_close_shared_pools_resets_singletons(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import mate_tech_rag.storage.pg_ext_store as pg_ext_store

        monkeypatch.setattr(pg_ext_store, "_POOLS", {})
        monkeypatch.setattr(
            pg_ext_store, "get_shared_pool", lambda dsn=None: FakePool(),
        )
        store = pg_ext_store.get_kb_document_store()
        assert pg_ext_store._kb_store is store
        pg_ext_store.close_shared_pools()
        assert pg_ext_store._kb_store is None
        assert pg_ext_store._metrics_store is None
        assert pg_ext_store._POOLS == {}


class TestCascadeKbCleanup:
    def test_cascade_deletes_kb_membership_rows(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import mate_tech_rag.api.retrieval as retrieval
        import mate_tech_rag.storage.pg_ext_store as pg_ext_store
        from mate_tech_rag.api.cascade import delete_document_cascade

        fake = FakeKbStore()
        fake.register("kb-1", "doc-cascade")
        monkeypatch.setattr(retrieval, "is_pg_mode", lambda: True)
        monkeypatch.setattr(pg_ext_store, "get_kb_document_store", lambda: fake)
        result = delete_document_cascade("tenant-acme", "doc-cascade")
        assert result.deleted is True
        assert fake.list_documents("kb-1") == []

    def test_cascade_skips_kb_cleanup_in_memory_mode(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import mate_tech_rag.api.retrieval as retrieval
        import mate_tech_rag.storage.pg_ext_store as pg_ext_store
        from mate_tech_rag.api.cascade import delete_document_cascade

        def _fail(dsn=None):  # pragma: no cover - must not be called
            raise AssertionError("get_kb_document_store must not run in memory mode")

        monkeypatch.setattr(retrieval, "is_pg_mode", lambda: False)
        monkeypatch.setattr(pg_ext_store, "get_kb_document_store", _fail)
        delete_document_cascade("tenant-acme", "doc-memory")  # must not raise
