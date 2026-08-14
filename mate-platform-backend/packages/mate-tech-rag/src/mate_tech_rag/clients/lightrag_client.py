"""LightRAGClient (THEMATIC retrieval: Neo4j lrag-graph thematic graph).

v3.0 Plan D: LightRAG provides "thematic" dimension retrieval.
- Storage: Neo4j lrag-graph
- Query: via LightRAG HTTP API (aquery / query)
- Protocol: returns ChunkHit list

Current: InMemory placeholder (Jaccard similarity on token sets).
"""
from __future__ import annotations

import threading
from typing import Protocol

from mate_tech_rag.api.schemas import ChunkHit


class LightRAGClient(Protocol):
    def query(self, query: str, top_k: int = 10) -> list[ChunkHit]: ...
    def insert(self, text: str, document_id: str, metadata: dict[str, str] | None = None) -> str: ...
    def count(self) -> int: ...
    def delete_by_document(self, document_id: str) -> int: ...


class InMemoryLightRAGClient:
    """Lightweight InMemory: token-set bucket + Jaccard similarity."""

    def __init__(self) -> None:
        self._chunks: dict[str, tuple[str, str, set[str], dict[str, str]]] = {}
        self._lock = threading.Lock()
        self._next_id = 0

    @staticmethod
    def _tokens(text: str) -> set[str]:
        out: set[str] = set()
        cur: list[str] = []
        for ch in text.lower():
            if ch.isalnum() or "\u4e00" <= ch <= "\u9fff":
                cur.append(ch)
            elif cur:
                out.add("".join(cur))
                cur = []
        if cur:
            out.add("".join(cur))
        return out

    def insert(self, text: str, document_id: str, metadata: dict[str, str] | None = None) -> str:
        with self._lock:
            cid = f"lrag-{self._next_id}"
            self._next_id += 1
            self._chunks[cid] = (cid, document_id, self._tokens(text), dict(metadata or {}))
        return cid

    def query(self, query: str, top_k: int = 10) -> list[ChunkHit]:
        q_tokens = self._tokens(query)
        if not q_tokens:
            return []
        scored: list[tuple[tuple[str, str, set[str], dict[str, str]], float]] = []
        with self._lock:
            for chunk in self._chunks.values():
                if not chunk[2]:
                    continue
                inter = len(q_tokens & chunk[2])
                union = len(q_tokens | chunk[2])
                if inter == 0 or union == 0:
                    continue
                jaccard = inter / union
                scored.append((chunk, jaccard))
        scored.sort(key=lambda t: t[1], reverse=True)
        return [
            ChunkHit(
                chunk_id=c[0],
                document_id=c[1],
                score=max(0.0, min(1.0, s)),
                text="",
                metadata={**c[3], "mode": "THEMATIC"},
            )
            for c, s in scored[: max(0, top_k)]
        ]

    def count(self) -> int:
        with self._lock:
            return len(self._chunks)

    def delete_by_document(self, document_id: str) -> int:
        """Drop all chunks belonging to ``document_id``. Returns the count removed."""
        with self._lock:
            to_drop = [cid for cid, c in self._chunks.items() if c[1] == document_id]
            for cid in to_drop:
                self._chunks.pop(cid, None)
            return len(to_drop)
