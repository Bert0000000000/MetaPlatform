"""GraphRAGClient (ENTITY retrieval: Neo4j rag-graphrag entity graph).

v3.0 Plan D: graph retrieval returns "entities" rather than chunks.
Current: InMemory simulation (regex-based entity extraction).
"""
from __future__ import annotations

import re
import threading
import uuid
from typing import Protocol

from mate_tech_rag.api.schemas import ChunkHit

_ENTITY_RE = re.compile(r"[\u4e00-\u9fff]{2,4}|[A-Z][A-Za-z0-9_]{2,}")


class GraphRAGClient(Protocol):
    def query(self, query: str, top_k: int = 10) -> list[ChunkHit]: ...
    def insert(self, text: str, document_id: str, metadata: dict[str, str] | None = None) -> str: ...
    def count(self) -> int: ...


class InMemoryGraphRAGClient:
    """Entity graph InMemory: extract 2-4 char Chinese / PascalCase identifiers as entities."""

    def __init__(self) -> None:
        # entity -> set of (chunk_id, document_id, snippet)
        self._entities: dict[str, set[tuple[str, str, str]]] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _extract_entities(text: str) -> set[str]:
        return set(_ENTITY_RE.findall(text))

    def insert(self, text: str, document_id: str, metadata: dict[str, str] | None = None) -> str:
        chunk_id = str(uuid.uuid4())
        entities = self._extract_entities(text)
        snippet = text[:80]
        with self._lock:
            for ent in entities:
                self._entities.setdefault(ent, set()).add((chunk_id, document_id, snippet))
        return chunk_id

    def query(self, query: str, top_k: int = 10) -> list[ChunkHit]:
        q_entities = self._extract_entities(query)
        if not q_entities:
            return []
        scored: list[tuple[str, set[tuple[str, str, str]], int]] = []
        with self._lock:
            for ent in q_entities:
                if ent in self._entities:
                    scored.append((ent, self._entities[ent], len(self._entities[ent])))
        scored.sort(key=lambda t: t[2], reverse=True)
        hits: list[ChunkHit] = []
        seen: set[str] = set()
        for ent, members, _ in scored:
            for cid, did, snippet in members:
                if cid in seen:
                    continue
                seen.add(cid)
                hits.append(
                    ChunkHit(
                        chunk_id=cid,
                        document_id=did,
                        score=1.0 / (1.0 + len(hits)),
                        text=snippet,
                        metadata={"entity": ent, "mode": "ENTITY"},
                    )
                )
                if len(hits) >= top_k:
                    return hits
        return hits

    def count(self) -> int:
        with self._lock:
            return len(self._entities)
