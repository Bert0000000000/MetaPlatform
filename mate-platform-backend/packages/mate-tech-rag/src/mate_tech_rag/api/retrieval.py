"""Retrieval service: 3-strategy router + real client factory."""
from __future__ import annotations

import logging
import os

from mate_tech_rag.api.schemas import ChunkHit, RetrievalRequest, RetrievalResponse
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
from mate_tech_rag.tokenize import tokenize_for_match

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
# True only when create_clients() wired the persistent PG backend
# (RAG_MODE=pg). Consumers (app kb registry, metrics persistence, cascade
# delete) branch on this flag; memory mode never touches PG.
_pg_mode: bool = False


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


def is_pg_mode() -> bool:
    """True when create_clients() wired the persistent PG backend."""
    return _pg_mode


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
    """Initialize real clients based on RAG_MODE env (memory|hybrid|hybrid_v2|graph|full).

    When PG_DSN is set, initializes PGClient + PGStore for BM25 full-text
    search, and upgrades the hybrid client to HybridV2Client (vector +
    BM25 score fusion) when Milvus is also active.

    RAG_MODE values:
      - memory    (default): pure in-memory; no external services.
      - pg               : everything persists to PG (kb_chunks hybrid +
                           rag_graph_edges ENTITY + rag_lightrag_chunks
                           THEMATIC + rag_kb_documents + rag_metrics).
      - hybrid           : try Milvus + (when PG_DSN) PG BM25; degrade to
                           InMemoryHybridClient on init failure.
      - hybrid_v2        : **force** InMemoryHybridV2Client (dev / scoring
                           verification path). Exercises the fusion math
                           without standing up Milvus / PG.
      - graph            : try Neo4j.
      - full             : try Milvus + Neo4j + LightRAG + RAGFlow.
    """
    global _hybrid, _graph, _lightrag, _ragflow, _hybrid_real, _graph_real, _pg_client, _pg_store, _pg_mode
    mode = os.environ.get("RAG_MODE", "memory").lower()
    _pg_mode = False

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

    # Persistent PG path: everything (chunks + embeddings + registry) lives
    # in kb_chunks and survives restarts. No Milvus needed.
    if mode == "pg":
        if _pg_client is not None and _pg_client.is_available():
            from mate_tech_rag.clients.pg_hybrid_client import PgHybridClient
            from mate_tech_rag.storage.pg_ext_store import PgGraphRAGClient, PgLightRAGClient

            _hybrid = PgHybridClient(pg=_pg_client)
            _graph = PgGraphRAGClient(dsn=pg_dsn)
            _lightrag = PgLightRAGClient(dsn=pg_dsn)
            if not (_graph.is_available() and _lightrag.is_available()):
                raise RuntimeError(
                    "RAG_MODE=pg requires a reachable PG_DSN for the "
                    "graph/lightrag stores "
                    f"(got: {os.environ.get('PG_DSN', '<unset>')})"
                )
            _pg_mode = True
            _log.info("PG persistent hybrid/graph/lightrag ACTIVE (RAG_MODE=pg)")
            _rebuild_registry_from_pg(_pg_client)
        else:
            raise RuntimeError(
                "RAG_MODE=pg requires a reachable PG_DSN "
                f"(got: {os.environ.get('PG_DSN', '<unset>')})"
            )
        return

    # Forced in-memory HybridV2 path (P1.6 dev/test escape hatch).
    if mode == "hybrid_v2":
        try:
            from mate_tech_rag.clients.hybrid_v2_client import InMemoryHybridV2Client

            _hybrid = InMemoryHybridV2Client()
            _log.info("HybridV2 in-memory ACTIVE (RAG_MODE=hybrid_v2)")
        except Exception as exc:
            _log.warning("InMemoryHybridV2 init failed, using InMemoryHybrid: %s", exc)
        return

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


def _rebuild_registry_from_pg(pg) -> int:
    """Restore the tenant document registry from persistent kb_chunks.

    Without this, a restart under RAG_MODE=pg wipes the in-memory registry and
    the search handler's tenant-scoped filter (``tenant_document_ids``)
    silently drops every hit.
    """
    from mate_tech_rag.api.document_registry import restore_document

    docs = pg.list_documents()
    for d in docs:
        restore_document(
            d["tenant_id"], d["document_id"],
            filename=d.get("filename", ""), chunk_count=d.get("chunk_count", 0),
        )
    _log.info("registry restored from PG: %s documents", len(docs))
    return len(docs)


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


def retrieve_with_config(
    req: RetrievalRequest,
    *,
    similarity_threshold: float | None = None,
    vector_weight: float | None = None,
    keyword_weight: float | None = None,
    kb_doc_ids: set[str] | None = None,
) -> RetrievalResponse:
    """Retrieve with optional tenant-config overrides applied.

    PATCH fix 2 + 3: The ``KbRetrievalConfig`` (mate-app-kb) and the IAM
    SystemConfig admin page both store ``similarity_threshold`` /
    ``vector_weight`` / ``keyword_weight``. Before this change these were
    stored but the retrieval pipeline ignored them — they were "config
    that's saved but doesn't take effect". This function now applies
    them so the admin UI controls actually drive the search behaviour.

    Parameters
    ----------
    req : RetrievalRequest
        The base request (query, top_k, kb_id, ...).
    similarity_threshold : float | None
        When > 0, hits with ``score < threshold`` are dropped. Applied
        AFTER weighted-score fusion so the threshold is compared against
        the final, user-visible score.
    vector_weight / keyword_weight : float | None
        Both must be supplied for weighted fusion to apply. The two
        weights are normalised to sum to 1.0 and combined with the
        vector score and a CJK-aware keyword-overlap ratio (see
        ``tokenize_for_match``).
    kb_doc_ids : set[str] | None
        When supplied together with ``req.kb_id``, only hits whose
        ``document_id`` is in this set are kept. An empty set means "no
        document belongs to this kb" — every hit is dropped so the
        caller never sees leakage from a different kb.
    """
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

    hits = result.hits

    # PATCH fix 3 (kb_id filter): when the request carries a kb_id and
    # the caller supplied an explicit allow-list of document_ids, keep
    # only hits whose document_id is in the set. The set is computed by
    # the endpoint via ``mate_app_kb.repositories.list_documents`` (single
    # process) or via the service-to-service HTTP call in production;
    # when no allow-list is supplied the filter is skipped so the
    # rag-only API contract is preserved.
    if req.kb_id and kb_doc_ids is not None:
        if kb_doc_ids:
            hits = [h for h in hits if h.document_id in kb_doc_ids]
        else:
            # An empty allow-list with a non-empty kb_id means no document
            # in this kb — return zero hits to avoid leaking from other kbs.
            hits = []

    # PATCH fix 2 (vector_weight / keyword_weight): weighted score fusion
    # over the hybrid vector score and the CJK-aware keyword overlap.
    # When the caller (mate-app-kb KbRetrievalConfig) supplies both weights
    # we recombine; otherwise we keep the upstream score unchanged.
    if vector_weight is not None and keyword_weight is not None:
        vw = float(vector_weight)
        kw = float(keyword_weight)
        total_w = vw + kw
        if total_w <= 0:
            vw, kw = 0.5, 0.5
            total_w = 1.0
        else:
            vw, kw = vw / total_w, kw / total_w
        query_terms = tokenize_for_match(req.query)
        if query_terms:
            new_hits: list[ChunkHit] = []
            for h in hits:
                text_terms = tokenize_for_match(h.text)
                overlap_ratio = (
                    len(query_terms & text_terms) / max(len(query_terms), 1)
                )
                vector_score = float(h.score)
                fused_score = max(
                    0.0, min(1.0, vw * vector_score + kw * overlap_ratio),
                )
                # Pydantic v2: ChunkHit is frozen; replace via model_copy.
                new_hits.append(h.model_copy(update={"score": fused_score}))
            hits = new_hits

    # PATCH fix 2 (similarity_threshold): drop hits below the configured
    # threshold AFTER any weighted-score recompute (so the threshold is
    # compared against the final, post-fusion score, matching what the
    # admin UI shows).
    if similarity_threshold is not None and similarity_threshold > 0:
        hits = [h for h in hits if h.score >= float(similarity_threshold)]

    # Re-truncate to top_k after filtering so the caller still sees <= top_k.
    hits = hits[: max(0, req.top_k)]

    return RetrievalResponse(
        query=req.query,
        hits=hits,
        total=len(hits),
        latency_ms=result.latency_ms,
        mode=mode.value,
    )
