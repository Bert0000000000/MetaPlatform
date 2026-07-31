"""PGClient (PostgreSQL 16 connection pool + tsvector BM25).

Per v3.0 Plan D: PostgreSQL stores chunk metadata + BM25 (tsvector + GIN index).
Vector search goes to Milvus. Hybrid = vector + BM25 score fusion.
"""
from __future__ import annotations

import contextlib
import logging
import os
import threading
from typing import Any

_log = logging.getLogger(__name__)


class PGClient:
    """psycopg 3 connection pool wrapper.

    Env: PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE.
    Falls back to InMemory (no-op) if server unreachable.
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
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS kb_chunks_ts_idx ON kb_chunks USING GIN (ts_vector);
        CREATE INDEX IF NOT EXISTS kb_chunks_doc_idx ON kb_chunks (document_id);
        """
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
                conn.commit()
            self._available = True
            _log.info("PGClient connected: %s", self._dsn.split("@")[-1])
        except Exception as exc:
            _log.warning("PGClient connect failed (graceful no-op): %s", exc)
            self._pool = None
            self._available = False

    def upsert_chunk(self, chunk_id: str, document_id: str, text: str, metadata: dict[str, Any] | None = None) -> bool:
        if not self._available or self._pool is None:
            return False
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO kb_chunks (chunk_id, document_id, text, metadata, ts_vector)
                        VALUES (%s, %s, %s, %s::jsonb, to_tsvector('english', %s))
                        ON CONFLICT (chunk_id) DO UPDATE
                        SET document_id = EXCLUDED.document_id,
                            text = EXCLUDED.text,
                            metadata = EXCLUDED.metadata,
                            ts_vector = EXCLUDED.ts_vector
                        """,
                        (chunk_id, document_id, text, _json_dump(metadata or {}), text),
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

    def bm25_search(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        if not self._available or self._pool is None:
            return []
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                        SELECT chunk_id, document_id, text, metadata,
                               ts_rank(ts_vector, plainto_tsquery('english', %s)) AS rank
                        FROM kb_chunks
                        WHERE ts_vector @@ plainto_tsquery('english', %s)
                        ORDER BY rank DESC
                        LIMIT %s
                        """,
                    (query, query, max(1, top_k)),
                )
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
    import json
    return json.dumps(obj, default=str, ensure_ascii=False)
