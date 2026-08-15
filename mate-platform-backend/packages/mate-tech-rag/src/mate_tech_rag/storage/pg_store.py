"""High-level PG store (document + chunk storage with BM25).

TC-2.1.1 + TC-2.1.6 wrapper.
"""
from __future__ import annotations

import logging
from typing import Any

from mate_tech_rag.clients.pg_client import PGClient

_log = logging.getLogger(__name__)


class PGStore:
    """High-level document storage on top of PGClient."""

    def __init__(self, pg: PGClient | None = None) -> None:
        self._pg = pg or PGClient()

    def save_chunk(
        self,
        chunk_id: str,
        document_id: str,
        text: str,
        metadata: dict[str, Any] | None = None,
        *,
        embedding: list[float] | None = None,
        tenant_id: str = "default",
    ) -> bool:
        return self._pg.upsert_chunk(
            chunk_id, document_id, text, metadata,
            embedding=embedding, tenant_id=tenant_id,
        )

    def save_chunks_bulk(self, chunks: list[dict[str, Any]]) -> int:
        saved = 0
        for c in chunks:
            if self.save_chunk(c["chunk_id"], c["document_id"], c["text"], c.get("metadata")):
                saved += 1
        return saved

    def bm25_search(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        return self._pg.bm25_search(query, top_k)

    def delete_document(self, document_id: str) -> int:
        return self._pg.delete_by_document(document_id)

    def count(self) -> int:
        return self._pg.count_chunks()

    def is_available(self) -> bool:
        return self._pg.is_available()

    def close(self) -> None:
        self._pg.close()
