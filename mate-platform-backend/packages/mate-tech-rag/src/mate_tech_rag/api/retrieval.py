"""Retrieval service: 3-strategy router + real client factory."""
from __future__ import annotations

import logging
import os

from mate_tech_rag.api.schemas import RetrievalRequest, RetrievalResponse
from mate_tech_rag.clients.graphrag_client import GraphRAGClient, InMemoryGraphRAGClient
from mate_tech_rag.clients.hybrid_client import HybridClient, InMemoryHybridClient
from mate_tech_rag.clients.lightrag_client import InMemoryLightRAGClient, LightRAGClient
from mate_tech_rag.clients.lightrag_httpx_client import HttpxLightRAGClient
from mate_tech_rag.clients.milvus_client import MilvusHybridClient
from mate_tech_rag.clients.neo4j_graphrag_client import Neo4jGraphRAGClient
from mate_tech_rag.clients.pg_client import PGClient
from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient, RAGFlowClient
from mate_tech_rag.clients.ragflow_httpx_client import HttpxRAGFlowClient
from mate_tech_rag.embedder import Embedder, create_embedder
from mate_tech_rag.router import RetrievalMode, detect_mode
from mate_tech_rag.storage.pg_store import PGStore
from mate_tech_rag.strategies.base import GraphStrategy, HybridStrategy, ThematicStrategy

_log = logging.getLogger(__name__)

_embedder: Embedder = create_embedder()
_hybrid: HybridClient = InMemoryHybridClient()
_graph: GraphRAGClient = InMemoryGraphRAGClient()
_lightrag: LightRAGClient = InMemoryLightRAGClient()
_ragflow: RAGFlowClient = InMemoryRAGFlowClient()
_pg_client: PGClient | None = None
_pg_store: PGStore | None = None
_hybrid_real: HybridClient | None = None
_graph_real: GraphRAGClient | None = None


def get_embedder() -> Embedder:
    return _embedder


def get_hybrid() -> HybridClient:
    return _hybrid


def get_graph() -> GraphRAGClient:
    return _graph


def get_lightrag() -> LightRAGClient:
    return _lightrag


def get_ragflow() -> RAGFlowClient:
    return _ragflow
def get_pg_store():
    return _pg_store


def get_pg_client():
    return _pg_client


def set_dependencies(
    *,
    embedder: Embedder | None = None,
    hybrid: HybridClient | None = None,
    graph: GraphRAGClient | None = None,
    lightrag: LightRAGClient | None = None,
    ragflow: RAGFlowClient | None = None,
) -> None:
    global _embedder, _hybrid, _graph, _lightrag, _ragflow
    if embedder is not None:
        _embedder = embedder
    if hybrid is not None:
        _hybrid = hybrid
    if graph is not None:
        _graph = graph
    if lightrag is not None:
        _lightrag = lightrag
    if ragflow is not None:
        _ragflow = ragflow


def create_clients():
    """Initialize real clients based on RAG_MODE env (memory|hybrid|graph|full).

    When PG_DSN is set, initializes PGClient + PGStore for BM25 full-text
    search, and upgrades the hybrid client to HybridV2Client (vector +
    BM25 score fusion) when Milvus is also active.
    """
    global _hybrid, _graph, _lightrag, _ragflow, _hybrid_real, _graph_real, _pg_client, _pg_store
    mode = os.environ.get("RAG_MODE", "memory").lower()

    # Initialize PG BM25 store if PG_DSN is configured.
    pg_dsn = os.environ.get("PG_DSN")
    if pg_dsn:
        try:
            _pg_client = PGClient(dsn=pg_dsn)
            _pg_store = PGStore(pg=_pg_client)
            if _pg_client.is_available():
                _log.info("PG BM25 ACTIVE: %s", pg_dsn.split("@")[-1])
            else:
                _log.warning("PG BM25 init: DSN set but server unreachable")
        except Exception as exc:
            _log.warning("PG BM25 init failed: %s", exc)
            _pg_client = None
            _pg_store = None

    if mode in ("hybrid", "full"):
        try:
            _hybrid_real = MilvusHybridClient()
            _hybrid = _hybrid_real
            _log.info("Milvus ACTIVE")
        except Exception as exc:
            _log.warning("Milvus init failed, using InMemory: %s", exc)
        # If PG is available, upgrade hybrid to HybridV2 (vector + BM25 fusion).
        if _pg_client is not None and _pg_client.is_available():
            try:
                from mate_tech_rag.clients.hybrid_v2_client import HybridV2Client

                _hybrid = HybridV2Client(milvus=_hybrid_real, pg=_pg_client)
                _log.info("HybridV2 ACTIVE (Milvus + PG BM25 fusion)")
            except Exception as exc:
                _log.warning("HybridV2 init failed, keeping pure vector: %s", exc)
    if mode in ("graph", "full"):
        try:
            _graph_real = Neo4jGraphRAGClient()
            _graph = _graph_real
            _log.info("Neo4j ACTIVE")
        except Exception as exc:
            _log.warning("Neo4j init failed, using InMemory: %s", exc)
    if mode in ("hybrid", "graph", "full"):
        try:
            _lightrag = HttpxLightRAGClient()
            _log.info("LightRAG HTTP client initialized")
        except Exception as exc:
            _log.warning("LightRAG init failed: %s", exc)
    if mode in ("hybrid", "graph", "full"):
        try:
            _ragflow = HttpxRAGFlowClient()
            _log.info("RAGFlow HTTP client initialized")
        except Exception as exc:
            _log.warning("RAGFlow init failed: %s", exc)


def reload_embedder(provider: str | None = None) -> None:
    global _embedder
    _embedder = create_embedder(provider)


def fake_chunk(text: str):
    import uuid

    from mate_tech_rag.api.schemas import ChunkHit
    return ChunkHit(
        chunk_id=str(uuid.uuid4()),
        document_id=str(uuid.uuid4()),
        score=0.95,
        text=text,
        metadata={"source": "test"},
    )


def _resolve_mode(requested: str) -> RetrievalMode:
    try:
        mode = RetrievalMode(requested)
    except ValueError:
        return RetrievalMode.FACTUAL
    if mode == RetrievalMode.AUTO:
        return RetrievalMode.AUTO
    return mode


def retrieve(req: RetrievalRequest) -> RetrievalResponse:
    mode = _resolve_mode(req.mode)
    if mode == RetrievalMode.AUTO:
        mode = detect_mode(req.query)
    if mode == RetrievalMode.FACTUAL:
        strat = HybridStrategy(get_hybrid(), get_embedder())
    elif mode == RetrievalMode.ENTITY:
        strat = GraphStrategy(get_graph())
    elif mode == RetrievalMode.THEMATIC:
        strat = ThematicStrategy(get_lightrag())
    else:
        strat = HybridStrategy(get_hybrid(), get_embedder())
    result = strat.search(req.query, req.top_k)

    # PG BM25 fallback: if hybrid is NOT HybridV2Client and PG store is
    # available, supplement insufficient vector results with BM25 hits.
    if mode == RetrievalMode.FACTUAL and _pg_store is not None and len(result.hits) < req.top_k:
        from mate_tech_rag.clients.hybrid_v2_client import HybridV2Client

        hybrid = get_hybrid()
        if not isinstance(hybrid, HybridV2Client):
            try:
                bm25_hits = _pg_store.bm25_search(req.query, req.top_k)
                existing_ids = {h.chunk_id for h in result.hits}
                for hit in bm25_hits:
                    if hit["chunk_id"] not in existing_ids and len(result.hits) < req.top_k:
                        result.hits.append(
                            ChunkHit(
                                chunk_id=hit["chunk_id"],
                                document_id=hit["document_id"],
                                score=min(float(hit["score"]), 1.0),
                                text=hit["text"],
                                metadata={**hit.get("metadata", {}), "mode": "BM25"},
                            )
                        )
            except Exception as exc:
                _log.debug("PG BM25 fallback skipped: %s", exc)

    return RetrievalResponse(
        query=req.query,
        hits=result.hits,
        total=len(result.hits),
        latency_ms=result.latency_ms,
        mode=mode.value,
    )
