"""Retrieval service: 3-strategy router + real client factory."""
from __future__ import annotations

import logging
import os

from mate_tech_rag.api.schemas import RetrievalResponse
from mate_tech_rag.clients.graphrag_client import GraphRAGClient, InMemoryGraphRAGClient
from mate_tech_rag.clients.hybrid_client import HybridClient, InMemoryHybridClient
from mate_tech_rag.clients.lightrag_client import InMemoryLightRAGClient, LightRAGClient
from mate_tech_rag.clients.milvus_client import MilvusHybridClient
from mate_tech_rag.clients.neo4j_graphrag_client import Neo4jGraphRAGClient
from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient, RAGFlowClient
from mate_tech_rag.embedder import Embedder, create_embedder
from mate_tech_rag.router import RetrievalMode, detect_mode
from mate_tech_rag.strategies.base import GraphStrategy, HybridStrategy, ThematicStrategy

_log = logging.getLogger(__name__)

_embedder: Embedder = create_embedder()
_hybrid: HybridClient = InMemoryHybridClient()
_graph: GraphRAGClient = InMemoryGraphRAGClient()
_lightrag: LightRAGClient = InMemoryLightRAGClient()
_ragflow: RAGFlowClient = InMemoryRAGFlowClient()
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


def set_dependencies(*, embedder=None, hybrid=None, graph=None, lightrag=None, ragflow=None):
    global _embedder, _hybrid, _graph, _lightrag, _ragflow
    if embedder is not None: _embedder = embedder
    if hybrid is not None: _hybrid = hybrid
    if graph is not None: _graph = graph
    if lightrag is not None: _lightrag = lightrag
    if ragflow is not None: _ragflow = ragflow


def create_clients():
    global _hybrid, _graph, _hybrid_real, _graph_real
    mode = os.environ.get("RAG_MODE", "memory").lower()
    if mode in ("hybrid", "full"):
        try:
            _hybrid_real = MilvusHybridClient()
            _hybrid = _hybrid_real
            _log.info("Milvus ACTIVE")
        except Exception as exc:
            _log.warning("Milvus init failed, using InMemory: %s", exc)
    if mode in ("graph", "full"):
        try:
            _graph_real = Neo4jGraphRAGClient()
            _graph = _graph_real
            _log.info("Neo4j ACTIVE")
        except Exception as exc:
            _log.warning("Neo4j init failed, using InMemory: %s", exc)


def reload_embedder(provider=None):
    global _embedder
    _embedder = create_embedder(provider)


def _resolve_mode(requested):
    try:
        mode = RetrievalMode(requested)
    except ValueError:
        return RetrievalMode.FACTUAL
    if mode == RetrievalMode.AUTO:
        return RetrievalMode.AUTO
    return mode


def retrieve(req):
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
    return RetrievalResponse(
        query=req.query,
        hits=result.hits,
        total=len(result.hits),
        latency_ms=result.latency_ms,
        mode=mode.value,
    )
