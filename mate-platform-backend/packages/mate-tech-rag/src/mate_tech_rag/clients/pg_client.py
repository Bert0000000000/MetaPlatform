"""PGClient (PostgreSQL 16 connection pool + tsvector BM25 + embedding store).

Per v3.0 Plan D: PostgreSQL stores chunk metadata + BM25 (tsvector + GIN index).

Persistence layer v2 (RAG_MODE=pg): the kb_chunks table additionally stores
the chunk ``embedding`` (JSONB float array) and ``tenant_id`` so the whole
RAG index survives restarts WITHOUT Milvus — vector search runs as cosine
over embeddings fetched from PG (fine at dev scale, ~10k chunks), and BM25
works for Chinese because ts_vector is built over a CJK-bigram token column
(``text_tokens``) produced by ``tokenize_for_match`` (the same tokenizer the
reranker/chunker use).

Vector search still goes to Milvus in RAG_MODE=hybrid|full; this module is
the single source of truth for the persistent copy either way.
"""
from __future__ import annotations

import contextlib
import json
import logging
import math
import os
import threading
from typing import Any

_log = logging.getLogger(__name__)


def _cjk_tokens(text: str) -> str:
    """Space-joined retrieval tokens: Latin words + CJK character bigrams.

    Mirrors ``mate_tech_rag.tokenize.tokenize_for_match`` so PG tsvector
    ('simple' config over this column) matches the same token boundaries the
    in-process rerankers use — Chinese runs become bigrams instead of one
    giant token, which makes BM25 actually fire on Chinese queries.
    """
    import re

    word_re = re.compile(r"[0-9A-Za-z]+")
    cjk_re = re.compile(r"[㐀-䶿一-鿿豈-﫿]+")
    tokens: list[str] = [w.lower() for w in word_re.findall(text)]
    for run in cjk_re.findall(text):
        if len(run) == 1:
            tokens.append(run)
        else:
            tokens.extend(run[i : i + 2] for i in range(len(run) - 1))
    return " ".join(tokens)


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


class PGClient:
    """psycopg 3 connection pool wrapper (sync; call from worker threads).

    Env: PG_DSN (falls back to PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE,
    then to the dev default). Graceful no-op when unreachable.
    """

    DEFAULT_DSN = "postgresql://mate:mate@localhost:5432/mate_kb"

    def __init__(self, dsn: str | None = None, min_size: int = 1, max_size: int = 5):
        self._dsn = dsn or os.environ.get("PG_DSN", self.DEFAULT_DSN)
        self._min_size = min_size
        self._max_size = max_size
        self._pool = None
        self._available = False
        self._lock = threading.Lock()
        self._init_schema_sql = """
        CREATE TABLE IF NOT EXISTS kb_chunks (
            chunk_id VARCHAR(64) PRIMARY KEY,
            document_id VARCHAR(64) NOT NULL,
            text TEXT NOT NULL,
            metadata JSONB,
            ts_vector TSVECTOR,
            tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
            embedding JSONB,
            text_tokens TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS kb_chunks_ts_idx ON kb_chunks USING GIN (ts_vector);
        CREATE INDEX IF NOT EXISTS kb_chunks_doc_idx ON kb_chunks (document_id);
        CREATE INDEX IF NOT EXISTS kb_chunks_tenant_idx ON kb_chunks (tenant_id);
        """
        # v1 -> v2 migration for pre-existing tables (idempotent, failures
        # ignored: an ALTER that fails because the column exists is fine).
        self._migrate_sql = [
            "ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default'",
            "ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding JSONB",
            "ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS text_tokens TEXT NOT NULL DEFAULT ''",
        ]
        self._connect()

    def _connect(self) -> None:
        try:
            from psycopg_pool import ConnectionPool  # pyright: ignore[reportMissingImports]
        except ImportError as exc:
            _log.warning("psycopg/psycopg_pool not installed: %s", exc)
            return
        try:
            self._pool = ConnectionPool(
                conninfo=self._dsn,
                min_size=self._min_size,
                max_size=self._max_size,
                timeout=5.0,
            )
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(self._init_schema_sql)
                    for stmt in self._migrate_sql:
                        with contextlib.suppress(Exception):
                            cur.execute(stmt)
                conn.commit()
            self._available = True
            _log.info("PGClient connected: %s", self._dsn.split("@")[-1])
        except Exception as exc:
            _log.warning("PGClient connect failed (graceful no-op): %s", exc)
            self._pool = None
            self._available = False

    # ------------------------------------------------------------------
    # Write path
    # ------------------------------------------------------------------
    def upsert_chunk(
        self,
        chunk_id: str,
        document_id: str,
        text: str,
        metadata: dict[str, Any] | None = None,
        *,
        embedding: list[float] | None = None,
        tenant_id: str = "default",
    ) -> bool:
        if not self._available or self._pool is None:
            return False
        meta = dict(metadata or {})
        if tenant_id and tenant_id != "default":
            meta.setdefault("tenant_id", tenant_id)
        emb_json = json.dumps(embedding) if embedding else None
        tokens = _cjk_tokens(text)
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO kb_chunks (chunk_id, document_id, text, metadata, ts_vector,
                                               tenant_id, embedding, text_tokens)
                        VALUES (%s, %s, %s, %s::jsonb,
                                to_tsvector('simple', %s),
                                %s, %s::jsonb, %s)
                        ON CONFLICT (chunk_id) DO UPDATE
                        SET document_id = EXCLUDED.document_id,
                            text = EXCLUDED.text,
                            metadata = EXCLUDED.metadata,
                            ts_vector = EXCLUDED.ts_vector,
                            tenant_id = EXCLUDED.tenant_id,
                            embedding = COALESCE(EXCLUDED.embedding, kb_chunks.embedding),
                            text_tokens = EXCLUDED.text_tokens
                        """,
                        (chunk_id, document_id, text, _json_dump(meta), tokens, tenant_id, emb_json, tokens),
                    )
                conn.commit()
            return True
        except Exception as exc:
            _log.warning("PG upsert_chunk failed: %s", exc)
            return False

    def delete_by_document(self, document_id: str) -> int:
        if not self._available:
            return 0
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM kb_chunks WHERE document_id = %s", (document_id,))
                    deleted = cur.rowcount
                conn.commit()
            return int(deleted or 0)
        except Exception as exc:
            _log.warning("PG delete_by_document failed: %s", exc)
            return 0

    # ------------------------------------------------------------------
    # Read path
    # ------------------------------------------------------------------
    def bm25_search(self, query: str, top_k: int = 10, *, tenant_id: str | None = None) -> list[dict[str, Any]]:
        """BM25 over the CJK-bigram token column. Works for Chinese + Latin."""
        if not self._available or self._pool is None:
            return []
        tokens = _cjk_tokens(query)
        if not tokens.strip():
            return []
        sql = """
            SELECT chunk_id, document_id, text, metadata,
                   ts_rank(ts_vector, plainto_tsquery('simple', %s)) AS rank
            FROM kb_chunks
            WHERE ts_vector @@ plainto_tsquery('simple', %s)
        """
        params: list[Any] = [tokens, tokens]
        if tenant_id:
            sql += " AND tenant_id = %s"
            params.append(tenant_id)
        sql += " ORDER BY rank DESC LIMIT %s"
        params.append(max(1, top_k))
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute(sql, tuple(params))
                rows = cur.fetchall()
            return [
                {
                    "chunk_id": r[0],
                    "document_id": r[1],
                    "text": r[2],
                    "metadata": r[3] or {},
                    "score": float(r[4] or 0.0),
                }
                for r in rows
            ]
        except Exception as exc:
            _log.warning("PG bm25_search failed: %s", exc)
            return []

    def vector_search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        *,
        tenant_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Cosine over persisted embeddings (PG-only persistent vector path).

        Fetches embeddings for the tenant and ranks in Python — appropriate at
        dev scale (~10k chunks); production scale wants pgvector or Milvus.
        """
        if not self._available or self._pool is None or not query_embedding:
            return []
        sql = "SELECT chunk_id, document_id, text, metadata, embedding FROM kb_chunks WHERE embedding IS NOT NULL"
        params: list[Any] = []
        if tenant_id:
            sql += " AND tenant_id = %s"
            params.append(tenant_id)
        sql += " LIMIT 20000"
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute(sql, tuple(params))
                rows = cur.fetchall()
            scored: list[tuple[float, dict[str, Any]]] = []
            for r in rows:
                emb = r[4]
                if isinstance(emb, str):
                    with contextlib.suppress(json.JSONDecodeError):
                        emb = json.loads(emb)
                if not isinstance(emb, list) or not emb:
                    continue
                score = _cosine(query_embedding, [float(x) for x in emb])
                scored.append(
                    (
                        score,
                        {
                            "chunk_id": r[0],
                            "document_id": r[1],
                            "text": r[2],
                            "metadata": r[3] or {},
                            "score": score,
                        },
                    )
                )
            scored.sort(key=lambda t: t[0], reverse=True)
            return [item for _, item in scored[: top_k]]
        except Exception as exc:
            _log.warning("PG vector_search failed: %s", exc)
            return []

    def list_documents(self, *, tenant_id: str | None = None) -> list[dict[str, Any]]:
        """Distinct documents (for registry rebuild after restart)."""
        if not self._available:
            return []
        sql = """
            SELECT document_id,
                   (metadata ->> 'tenant_id') AS doc_tenant,
                   (metadata ->> 'filename') AS filename,
                   count(*) AS chunks,
                   min(created_at) AS first_at
            FROM kb_chunks
            GROUP BY document_id, metadata ->> 'tenant_id', metadata ->> 'filename'
        """
        params: tuple[Any, ...] = ()
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
            docs = []
            for r in rows:
                doc_tenant = r[1] or "default"
                if tenant_id and doc_tenant != tenant_id:
                    continue
                docs.append(
                    {
                        "document_id": r[0],
                        "tenant_id": doc_tenant,
                        "filename": r[2] or "",
                        "chunk_count": int(r[3] or 0),
                    }
                )
            return docs
        except Exception as exc:
            _log.warning("PG list_documents failed: %s", exc)
            return []

    def count_chunks(self) -> int:
        if not self._available:
            return 0
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM kb_chunks")
                row = cur.fetchone()
            return int(row[0]) if row else 0
        except Exception:
            return 0

    def is_available(self) -> bool:
        return self._available

    def close(self) -> None:
        if self._pool is not None:
            with contextlib.suppress(Exception):
                self._pool.close()
            self._pool = None


def _json_dump(obj: Any) -> str:
    return json.dumps(obj, default=str, ensure_ascii=False)
