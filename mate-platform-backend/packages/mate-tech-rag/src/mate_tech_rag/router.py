"""Retrieval strategy router (v3.0 Plan D).

Routes query to one of 3 strategies:
- FACTUAL  -> HybridStrategy (Milvus + BM25)
- ENTITY   -> GraphStrategy (Neo4j entity graph / GraphRAG)
- THEMATIC -> ThematicStrategy (LightRAG Neo4j lrag-graph)
- AUTO     -> heuristic (PascalCase -> ENTITY, long desc -> THEMATIC, else FACTUAL)
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

from mate_tech_rag.api.schemas import ChunkHit


class RetrievalMode(StrEnum):
    FACTUAL = "FACTUAL"
    ENTITY = "ENTITY"
    THEMATIC = "THEMATIC"
    AUTO = "AUTO"


@dataclass
class RetrievalResult:
    mode: RetrievalMode
    hits: list[ChunkHit]
    latency_ms: int


def detect_mode(query: str) -> RetrievalMode:
    """AUTO heuristic.

    1. Contains PascalCase identifier -> ENTITY
    2. Length > 30 (descriptive) -> THEMATIC
    3. Otherwise -> FACTUAL
    """
    if re.search(r"[A-Z][A-Za-z0-9_]{2,}", query):
        return RetrievalMode.ENTITY
    if len(query) > 30:
        return RetrievalMode.THEMATIC
    return RetrievalMode.FACTUAL
