"""PostgresSaver: state persistence via psycopg (TC-5.7.4 瀹屾暣鐗?."""
from __future__ import annotations

import contextlib
import json
import logging
import os
import threading

_log = logging.getLogger(__name__)


class PGSaver:
    """Postgres-backed state saver.

    Schema:
      CREATE TABLE IF NOT EXISTS kb_agent_threads (
          thread_id VARCHAR(64) PRIMARY KEY,
          state JSONB NOT NULL,
          scenario VARCHAR(16) DEFAULT 'S1',
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    """

    DEFAULT_DSN = "postgresql://mate:mate@localhost:5432/mate_kb"

    def __init__(self, dsn=None, min_size=1, max_size=3):
        self._dsn = dsn or os.environ.get("AGENT_PG_DSN", self.DEFAULT_DSN)
        self._min_size = min_size
        self._max_size = max_size
        self._pool = None
        self._available = False
        self._lock = threading.Lock()
        self._init_schema_sql = """
        CREATE TABLE IF NOT EXISTS kb_agent_threads (
            thread_id VARCHAR(64) PRIMARY KEY,
            state JSONB NOT NULL,
            scenario VARCHAR(16) DEFAULT 'S1',
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
        self._connect()

    def _connect(self):
        try:
            from psycopg_pool import ConnectionPool
            self._pool = ConnectionPool(conninfo=self._dsn, min_size=self._min_size, max_size=self._max_size, timeout=5.0)
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(self._init_schema_sql)
                conn.commit()
            self._available = True
            _log.info("PGSaver connected: %s", self._dsn.split("@")[-1])
        except Exception as exc:
            _log.warning("PGSaver connect failed (graceful no-op): %s", exc)
            self._pool = None
            self._available = False

    def save(self, thread_id, state, scenario="S1"):
        if not self._available or self._pool is None:
            return False
        try:
            payload = json.dumps(state, default=str, ensure_ascii=False)
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO kb_agent_threads (thread_id, state, scenario, updated_at) VALUES (%s, %s::jsonb, %s, NOW()) ON CONFLICT (thread_id) DO UPDATE SET state=EXCLUDED.state, scenario=EXCLUDED.scenario, updated_at=NOW()",
                        (thread_id, payload, scenario),
                    )
                conn.commit()
            return True
        except Exception as exc:
            _log.warning("PGSaver save failed: %s", exc)
            return False

    def load(self, thread_id):
        if not self._available or self._pool is None:
            return None
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute("SELECT state FROM kb_agent_threads WHERE thread_id = %s", (thread_id,))
                row = cur.fetchone()
            if not row:
                return None
            state = row[0]
            return json.loads(state) if isinstance(state, str) else state
        except Exception as exc:
            _log.warning("PGSaver load failed: %s", exc)
            return None

    def delete(self, thread_id):
        if not self._available or self._pool is None:
            return False
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM kb_agent_threads WHERE thread_id = %s", (thread_id,))
                    deleted = cur.rowcount
                conn.commit()
            return int(deleted or 0) > 0
        except Exception:
            return False

    def count(self):
        if not self._available or self._pool is None:
            return 0
        try:
            with self._pool.connection() as conn, conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM kb_agent_threads")
                row = cur.fetchone()
            return int(row[0]) if row else 0
        except Exception:
            return 0

    def is_available(self):
        return self._available

    def close(self):
        if self._pool is not None:
            with contextlib.suppress(Exception):
                self._pool.close()
            self._pool = None
