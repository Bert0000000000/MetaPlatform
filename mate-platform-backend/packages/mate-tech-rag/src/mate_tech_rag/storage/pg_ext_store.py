"""PG persistence for the remaining in-memory RAG surfaces (RAG_MODE=pg).

The baseline persistence layer (``clients/pg_client.py`` + ``storage/pg_store.py``
+ ``clients/pg_hybrid_client.py`` — maintainer-owned, untouched here) already
keeps hybrid FACTUAL retrieval alive across restarts via the ``kb_chunks``
table. This module extends the same persistence story to the surfaces that
were still process-local:

  ==================  =====================================================
  ``rag_graph_edges``     ENTITY retrieval (GraphRAG) — replaces the
                          InMemoryGraphRAGClient entity table.
  ``rag_lightrag_chunks`` THEMATIC retrieval (LightRAG) — replaces the
                          InMemoryLightRAGClient token buckets.
  ``rag_kb_documents``    kb_id -> document_id membership (the app-level
                          ``_kb_documents`` dict).
  ``rag_metrics``         per-endpoint latency aggregates (accumulating
                          upsert of the api/metrics LatencyBuckets).
  ==================  =====================================================

Everything here only activates under ``RAG_MODE=pg`` (wired from
``api/retrieval.py:create_clients``); the memory-mode code paths are
unchanged. All DDL is ``CREATE TABLE IF NOT EXISTS`` (self-healing) and runs
once per DSN against a single shared psycopg connection pool.

The CJK tokenizer below is a deliberate COPY of the one in ``pg_client.py``
(see that module for the rationale): importing the maintainer's private
``_cjk_tokens`` would couple this module to internals we do not own.
"""
from __future__ import annotations

import contextlib
import json
import logging
import os
import re
import threading
from typing import Any

from mate_tech_rag.api.schemas import ChunkHit

_log = logging.getLogger(__name__)


def _cjk_tokens(text: str) -> str:
    """Space-joined retrieval tokens: Latin words + CJK character bigrams.

    Copied from ``pg_client._cjk_tokens`` on purpose (no private imports):
    PG tsvector over this column matches the same token boundaries the
    in-process tokenizer produces, so Chinese runs become bigrams instead
    of one giant token and BM25 actually fires on Chinese queries.
    """
    word_re = re.compile(r"[0-9A-Za-z]+")
    cjk_re = re.compile(r"[㐀-䶿一-鿿豈-﫿]+")
    tokens: list[str] = [w.lower() for w in word_re.findall(text)]
    for run in cjk_re.findall(text):
        if len(run) == 1:
            tokens.append(run)
        else:
            tokens.extend(run[i : i + 2] for i in range(len(run) - 1))
    return " ".join(tokens)


def _meta_to_dict(raw: Any) -> dict[str, str]:
    """Normalise a JSONB metadata cell (dict or JSON str) to dict[str, str]."""
    if isinstance(raw, str):
        with contextlib.suppress(json.JSONDecodeError):
            raw = json.loads(raw)
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items()}


def _json_dump(obj: Any) -> str:
    return json.dumps(obj, default=str, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Shared connection pool + one-shot DDL
# ---------------------------------------------------------------------------
_DDL = """
CREATE TABLE IF NOT EXISTS rag_graph_edges (
    id BIGSERIAL PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    text TEXT NOT NULL,
    metadata JSONB,
    text_tokens TEXT NOT NULL DEFAULT '',
    ts_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rag_graph_edges_ts_idx ON rag_graph_edges USING GIN (ts_vector);
CREATE INDEX IF NOT EXISTS rag_graph_edges_doc_idx ON rag_graph_edges (document_id);

CREATE TABLE IF NOT EXISTS rag_lightrag_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    text TEXT NOT NULL,
    metadata JSONB,
    text_tokens TEXT NOT NULL DEFAULT '',
    ts_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rag_lightrag_chunks_ts_idx ON rag_lightrag_chunks USING GIN (ts_vector);
CREATE INDEX IF NOT EXISTS rag_lightrag_chunks_doc_idx ON rag_lightrag_chunks (document_id);

CREATE TABLE IF NOT EXISTS rag_kb_documents (
    kb_id VARCHAR(64) NOT NULL,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (kb_id, document_id)
);

CREATE TABLE IF NOT EXISTS rag_metrics (
    endpoint VARCHAR(64) PRIMARY KEY,
    count BIGINT NOT NULL DEFAULT 0,
    sum_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    p95_last DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
"""

_POOL_LOCK = threading.Lock()
_POOLS: dict[str, Any] = {}


def get_shared_pool(dsn: str | None = None) -> Any:
    """Return a cached psycopg pool for ``dsn`` (or PG_DSN), running the DDL.

    Returns None (never raises) when the DSN is empty, psycopg is missing,
    or the server is unreachable — callers degrade gracefully.
    """
    resolved = dsn or os.environ.get("PG_DSN") or ""
    if not resolved:
        return None
    with _POOL_LOCK:
        cached = _POOLS.get(resolved)
        if cached is not None:
            return cached
        pool = None
        try:
            from psycopg_pool import ConnectionPool  # pyright: ignore[reportMissingImports]

            pool = ConnectionPool(
                conninfo=resolved, min_size=1, max_size=3, timeout=5.0, open=True,
            )
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(_DDL)
                conn.commit()
        except Exception as exc:
            _log.warning(
                "pg_ext_store pool init failed for %s: %s",
                resolved.split("@")[-1], exc,
            )
            if pool is not None:
                with contextlib.suppress(Exception):
                    pool.close()
            return None
        _POOLS[resolved] = pool
        _log.info("pg_ext_store pool ready: %s", resolved.split("@")[-1])
        return pool


def close_shared_pools() -> None:
    """Close every cached pool and forget the store singletons (test helper)."""
    with _POOL_LOCK:
        for pool in _POOLS.values():
            with contextlib.suppress(Exception):
                pool.close()
        _POOLS.clear()
    reset_store_singletons()


class _BasePgStore:
    """Small shared primitive layer over the pooled psycopg connection."""

    def __init__(self, pool: Any = None, dsn: str | None = None) -> None:
        # An explicitly injected pool (tests / shared wiring) skips the
        # self-managed pool entirely (and never reconnects).
        if pool is not None:
            self._dsn = ""
            self._pool = pool
        else:
            self._dsn = dsn or os.environ.get("PG_DSN") or ""
            self._pool = get_shared_pool(dsn)
        self._available = self._pool is not None

    def is_available(self) -> bool:
        return self._available

    def _reconnect(self) -> None:
        """Best-effort pool resurrection after a connection-level failure.

        Evicts the dead pool for our DSN from the shared cache and re-opens
        one, so a mid-run PG restart only costs one failed call instead of
        dead stores until the next process restart. Stores built on an
        injected pool (tests) never reconnect.
        """
        if not self._dsn:
            return
        with _POOL_LOCK:
            stale = _POOLS.pop(self._dsn, None)
        if stale is not None:
            with contextlib.suppress(Exception):
                stale.close()
        pool = get_shared_pool(self._dsn)
        self._pool = pool
        self._available = pool is not None

    @staticmethod
    def _is_connection_failure(exc: Exception) -> bool:
        msg = str(exc).lower()
        return any(k in msg for k in ("pool", "connection", "timeout", "closed"))

    def _exec(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        """Run a write statement; returns rowcount (0 on any failure)."""
        if not self._available or self._pool is None:
            return 0
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    rowcount = cur.rowcount
                conn.commit()
            return int(rowcount or 0)
        except Exception as exc:
            _log.warning("%s _exec failed: %s", type(self).__name__, exc)
            if self._is_connection_failure(exc):
                self._reconnect()
            return 0

    def _fetch(self, sql: str, params: tuple[Any, ...] = ()) -> list[tuple]:
        if not self._available or self._pool is None:
            return []
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute(sql, params)
                return list(cur.fetchall())
        except Exception as exc:
            _log.warning("%s _fetch failed: %s", type(self).__name__, exc)
            if self._is_connection_failure(exc):
                self._reconnect()
            return []

    def _fetchone(self, sql: str, params: tuple[Any, ...] = ()) -> tuple | None:
        rows = self._fetch(sql, params)
        return rows[0] if rows else None


# ---------------------------------------------------------------------------
# 1. ENTITY (GraphRAG) persistence
# ---------------------------------------------------------------------------
class PgGraphRAGClient(_BasePgStore):
    """Persistent GraphRAG client — same surface as InMemoryGraphRAGClient.

    ``query`` is what ``GraphStrategy`` calls (query string, top_k); hits
    are BM25-ish ts_rank results over the CJK-bigram token column.
    """

    _TABLE = "rag_graph_edges"
    _ID_PREFIX = "gedge-"
    _MODE = "ENTITY"

    def insert(self, text: str, document_id: str, metadata: dict[str, str] | None = None) -> str:
        tokens = _cjk_tokens(text)
        row = self._fetchone(
            f"""
            INSERT INTO {self._TABLE} (document_id, text, metadata, text_tokens, ts_vector)
            VALUES (%s, %s, %s::jsonb, %s, to_tsvector('simple', %s))
            RETURNING id
            """,
            (document_id, text, _json_dump(metadata or {}), tokens, tokens),
        )
        if row is None:
            return ""
        return f"{self._ID_PREFIX}{row[0]}"

    def query(self, query: str, top_k: int = 10) -> list[ChunkHit]:
        if not self._available:
            return []
        tokens = _cjk_tokens(query)
        if not tokens.strip():
            return []
        rows = self._fetch(
            f"""
            SELECT id, document_id, text, metadata,
                   ts_rank(ts_vector, plainto_tsquery('simple', %s)) AS rank
            FROM {self._TABLE}
            WHERE ts_vector @@ plainto_tsquery('simple', %s)
            ORDER BY rank DESC
            LIMIT %s
            """,
            (tokens, tokens, max(1, top_k)),
        )
        if not rows:
            return []
        max_rank = max(float(r[4] or 0.0) for r in rows)
        hits: list[ChunkHit] = []
        for r in rows:
            rank = float(r[4] or 0.0)
            score = rank / max_rank if max_rank > 0 else 0.0
            meta = _meta_to_dict(r[3])
            meta["mode"] = self._MODE
            hits.append(
                ChunkHit(
                    chunk_id=f"{self._ID_PREFIX}{r[0]}",
                    document_id=str(r[1]),
                    score=round(min(max(score, 0.0), 1.0), 4),
                    text=str(r[2] or ""),
                    metadata=meta,
                )
            )
        return hits

    # Convenience alias matching the GraphRAGClient Protocol naming used in
    # some call sites (GraphStrategy itself calls ``query``).
    def search(self, query: str, top_k: int = 10) -> list[ChunkHit]:
        return self.query(query, top_k)

    def count(self) -> int:
        row = self._fetchone(f"SELECT count(*) FROM {self._TABLE}")
        return int(row[0]) if row else 0

    def delete_by_document(self, document_id: str) -> int:
        return self._exec(
            f"DELETE FROM {self._TABLE} WHERE document_id = %s", (document_id,),
        )


# ---------------------------------------------------------------------------
# 2. THEMATIC (LightRAG) persistence
# ---------------------------------------------------------------------------
class PgLightRAGClient(_BasePgStore):
    """Persistent LightRAG client — same surface as InMemoryLightRAGClient."""

    _TABLE = "rag_lightrag_chunks"
    _ID_PREFIX = "lrag-"
    _MODE = "THEMATIC"

    def insert(self, text: str, document_id: str, metadata: dict[str, str] | None = None) -> str:
        tokens = _cjk_tokens(text)
        row = self._fetchone(
            f"""
            INSERT INTO {self._TABLE} (document_id, text, metadata, text_tokens, ts_vector)
            VALUES (%s, %s, %s::jsonb, %s, to_tsvector('simple', %s))
            RETURNING id
            """,
            (document_id, text, _json_dump(metadata or {}), tokens, tokens),
        )
        if row is None:
            return ""
        return f"{self._ID_PREFIX}{row[0]}"

    def query(self, query: str, top_k: int = 10) -> list[ChunkHit]:
        if not self._available:
            return []
        tokens = _cjk_tokens(query)
        if not tokens.strip():
            return []
        rows = self._fetch(
            f"""
            SELECT id, document_id, text, metadata,
                   ts_rank(ts_vector, plainto_tsquery('simple', %s)) AS rank
            FROM {self._TABLE}
            WHERE ts_vector @@ plainto_tsquery('simple', %s)
            ORDER BY rank DESC
            LIMIT %s
            """,
            (tokens, tokens, max(1, top_k)),
        )
        if not rows:
            return []
        max_rank = max(float(r[4] or 0.0) for r in rows)
        hits: list[ChunkHit] = []
        for r in rows:
            rank = float(r[4] or 0.0)
            score = rank / max_rank if max_rank > 0 else 0.0
            meta = _meta_to_dict(r[3])
            meta["mode"] = self._MODE
            hits.append(
                ChunkHit(
                    chunk_id=f"{self._ID_PREFIX}{r[0]}",
                    document_id=str(r[1]),
                    score=round(min(max(score, 0.0), 1.0), 4),
                    text=str(r[2] or ""),
                    metadata=meta,
                )
            )
        return hits

    def search(self, query: str, top_k: int = 10) -> list[ChunkHit]:
        return self.query(query, top_k)

    def count(self) -> int:
        row = self._fetchone(f"SELECT count(*) FROM {self._TABLE}")
        return int(row[0]) if row else 0

    def delete_by_document(self, document_id: str) -> int:
        return self._exec(
            f"DELETE FROM {self._TABLE} WHERE document_id = %s", (document_id,),
        )


# ---------------------------------------------------------------------------
# 3. kb_id -> document_id membership persistence
# ---------------------------------------------------------------------------
class PgKbDocumentStore(_BasePgStore):
    """Persistent replacement for the app-level ``_kb_documents`` dict."""

    def register(self, kb_id: str, document_id: str, tenant_id: str = "default") -> bool:
        return self._exec(
            """
            INSERT INTO rag_kb_documents (kb_id, document_id, tenant_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (kb_id, document_id) DO UPDATE
            SET tenant_id = EXCLUDED.tenant_id
            """,
            (kb_id, document_id, tenant_id or "default"),
        ) > 0

    def unregister(self, kb_id: str, document_id: str) -> int:
        return self._exec(
            "DELETE FROM rag_kb_documents WHERE kb_id = %s AND document_id = %s",
            (kb_id, document_id),
        )

    def list_documents(self, kb_id: str) -> list[str]:
        rows = self._fetch(
            "SELECT document_id FROM rag_kb_documents WHERE kb_id = %s ORDER BY document_id",
            (kb_id,),
        )
        return [str(r[0]) for r in rows]

    def delete_by_document(self, document_id: str) -> int:
        return self._exec(
            "DELETE FROM rag_kb_documents WHERE document_id = %s", (document_id,),
        )

    def clear(self) -> int:
        """Drop every membership row (test / reset helper)."""
        return self._exec("DELETE FROM rag_kb_documents")


# ---------------------------------------------------------------------------
# 4. Latency metrics persistence (accumulating upsert)
# ---------------------------------------------------------------------------
class PgMetricsStore(_BasePgStore):
    """Persistent per-endpoint latency aggregates for api/metrics buckets."""

    def upsert(self, endpoint: str, count_delta: int, sum_delta_ms: float, p95_last: float) -> bool:
        """Accumulate ``count_delta`` / ``sum_delta_ms`` into ``rag_metrics``.

        ``p95_last`` is a last-writer-wins snapshot of the in-memory sliding
        window's p95 at flush time.
        """
        return self._exec(
            """
            INSERT INTO rag_metrics (endpoint, count, sum_ms, p95_last, updated_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (endpoint) DO UPDATE SET
                count = rag_metrics.count + EXCLUDED.count,
                sum_ms = rag_metrics.sum_ms + EXCLUDED.sum_ms,
                p95_last = EXCLUDED.p95_last,
                updated_at = NOW()
            """,
            (endpoint, int(count_delta), float(sum_delta_ms), float(p95_last)),
        ) > 0

    def load_all(self) -> dict[str, dict[str, Any]]:
        rows = self._fetch(
            "SELECT endpoint, count, sum_ms, p95_last, updated_at FROM rag_metrics"
        )
        return {
            str(r[0]): {
                "count": int(r[1] or 0),
                "sum_ms": float(r[2] or 0.0),
                "p95_last": float(r[3] or 0.0),
                "updated_at": str(r[4]) if r[4] is not None else "",
            }
            for r in rows
        }

    def delete_all(self) -> int:
        """Drop every metrics row (test / smoke helper)."""
        return self._exec("DELETE FROM rag_metrics")


# ---------------------------------------------------------------------------
# Module-level singletons (wired only under RAG_MODE=pg)
# ---------------------------------------------------------------------------
_kb_store: PgKbDocumentStore | None = None
_metrics_store: PgMetricsStore | None = None
_singleton_lock = threading.Lock()


def get_kb_document_store(dsn: str | None = None) -> PgKbDocumentStore:
    global _kb_store
    with _singleton_lock:
        if _kb_store is None:
            _kb_store = PgKbDocumentStore(dsn=dsn)
        return _kb_store


def get_metrics_store(dsn: str | None = None) -> PgMetricsStore:
    global _metrics_store
    with _singleton_lock:
        if _metrics_store is None:
            _metrics_store = PgMetricsStore(dsn=dsn)
        return _metrics_store


def reset_store_singletons() -> None:
    """Forget the cached store singletons (test helper)."""
    global _kb_store, _metrics_store
    with _singleton_lock:
        _kb_store = None
        _metrics_store = None
