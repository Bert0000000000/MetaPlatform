"""FastAPI app: RAGFlow + Milvus/Neo4j/PG real clients + multipart upload + 3-strategy retrieval.

BUSINESS-SLICES deep implementation: adds ADR-0014 step 3 (outbox
events: rag.document.ingested / rag.document.uploaded / rag.search.executed),
tenant-scoped document registry with lifecycle (INGESTING -> INDEXED |
FAILED), chunk-content validation, and tenant-scoped search hit
filtering so tenant A cannot retrieve tenant B's indexed chunks.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile

# BUSINESS-SLICES P1 wave 3: hooks 1, 2 (auth + tenant).
# BUSINESS-SLICES deep: hook 3 (outbox) + tenant document registry + validation.
from mate_platform.auth import install_auth
from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.observability import journey_span
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant
from mate_tech_rag import __version__
from mate_tech_rag.api.document_registry import (
    mark_indexed,
    register_document,
    tenant_document_ids,
)
from mate_tech_rag.api.ingest import ingest
from mate_tech_rag.api.parse import parse_document
from mate_tech_rag.api.retrieval import (
    create_clients as init_real_clients,
)
from mate_tech_rag.api.retrieval import (
    get_embedder,
    get_graph,
    get_hybrid,
    get_lightrag,
    get_pg_store,
    get_ragflow,
    retrieve,
)
from mate_tech_rag.api.schemas import (
    ChunkHit,
    EmbedderInfo,
    HealthResponse,
    IndexStatus,
    IngestRequest,
    IngestResponse,
    ParseRequest,
    ParseResponse,
    PgStatsResponse,
    RetrievalRequest,
    RetrievalResponse,
    StatsResponse,
    SystemStatus,
    UploadResponse,
)
from mate_tech_rag.reranker import RerankCandidate, create_reranker

_log = logging.getLogger(__name__)


def _backend_label(client: object) -> str:
    name = type(client).__name__
    if "Milvus" in name:
        return "milvus"
    if "Neo4j" in name:
        return "neo4j"
    if "Httpx" in name and "LightRAG" in name:
        return "lightrag-http"
    if "LightRAG" in name:
        return "lightrag"
    return "memory"


def _emit(
    request: Request,
    event_type: str,
    aggregate_id: str,
    payload: dict[str, Any],
    tenant_id: str,
) -> None:
    """Append an outbox event if a writer is configured (ADR-0014 step 3)."""
    writer: InMemoryOutboxWriter | None = getattr(
        request.app.state, "outbox_writer", None
    )
    if writer is None:
        return
    writer.append(
        Event.create(
            type=event_type,
            tenant_id=TenantId(tenant_id),
            aggregate_id=aggregate_id,
            payload=payload,
            trace_id=getattr(request.state.ctx, "trace_id", ""),
        )
    )


def create_app() -> FastAPI:
    app = FastAPI(
        title="mate-tech-rag",
        version=__version__,
        description="Mate Platform RAG: RAGFlow parse + Hybrid(Milvus) + GraphRAG(Neo4j) + LightRAG",
    )

    # Hook 1 of 5: install auth middleware (SEC-IAM-01).
    install_auth(app)
    # Default outbox writer (no-op until a test attaches one).
    if not hasattr(app.state, "outbox_writer"):
        app.state.outbox_writer = InMemoryOutboxWriter()

    def _require_ctx(request: Request):
        # Defence in depth: install_auth populates ctx or returns 401.
        ctx = getattr(request.state, 'ctx', None)
        if ctx is None:
            raise HTTPException(status_code=401, detail='no auth context')
        return ctx

    @app.get("/healthz", response_model=HealthResponse)
    async def healthz() -> HealthResponse:  # pyright: ignore[reportUnusedFunction]
        return HealthResponse(status="ok", service="mate-tech-rag", version=__version__)

    @app.get("/api/v1/rag/status", response_model=SystemStatus)
    async def status(request: Request) -> SystemStatus:  # pyright: ignore[reportUnusedFunction]
        # Hook 2 of 5: tenant guard.
        _require_ctx(request)
        require_tenant(request.state.ctx)
        emb = get_embedder()
        provider_name = os.environ.get("EMBEDDER_PROVIDER", "local")
        model_name = getattr(emb, "_model", "") if provider_name == "openai" else type(emb).__name__
        return SystemStatus(
            status="ok",
            service="mate-tech-rag",
            version=__version__,
            embedder=EmbedderInfo(
                provider=provider_name,
                dim=emb.dim,
                model_name=model_name,
            ),
            indexes=[
                IndexStatus(name="hybrid", backend=_backend_label(get_hybrid()), chunk_count=get_hybrid().count()),
                IndexStatus(name="graph", backend=_backend_label(get_graph()), chunk_count=get_graph().count()),
                IndexStatus(name="lightrag", backend=_backend_label(get_lightrag()), chunk_count=get_lightrag().count()),
            ],
        )

    @app.post("/api/v1/rag/parse", response_model=ParseResponse)
    async def parse_endpoint(request: Request, req: ParseRequest) -> ParseResponse:  # pyright: ignore[reportUnusedFunction]
        _require_ctx(request)
        require_tenant(request.state.ctx)
        tenant_id = str(request.state.ctx.tenant_id)
        try:
            result = parse_document(req)
            # Register the parsed document in the tenant registry.
            register_document(
                tenant_id, req.document_id, source="parse",
            )
            mark_indexed(tenant_id, req.document_id, result.chunk_count)
            # Hook 3 of 5: emit document-parsed event.
            _emit(
                request, "rag.document.parsed", req.document_id,
                {"document_id": req.document_id, "chunks": result.chunk_count},
                tenant_id,
            )
            return result
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/rag/upload", response_model=UploadResponse)
    async def upload_endpoint(  # pyright: ignore[reportUnusedFunction]
        request: Request,
        file: UploadFile = File(..., description="text/markdown file to ingest"),
        document_id: str | None = None,
    ) -> UploadResponse:
        # Hook 2 of 5: tenant guard.
        _require_ctx(request)
        require_tenant(request.state.ctx)
        tenant_id = str(request.state.ctx.tenant_id)
        try:
            raw = await file.read()
            if not raw:
                raise HTTPException(status_code=400, detail="empty file")
            doc_id = document_id or str(uuid.uuid4())
            # Register document in INGESTING state.
            register_document(
                tenant_id, doc_id, filename=file.filename or "",
                size_bytes=len(raw), source="upload",
            )
            ragflow = get_ragflow()
            embedder = get_embedder()
            hybrid = get_hybrid()
            graph = get_graph()
            lightrag = get_lightrag()

            chunks = ragflow.parse_bytes(raw, doc_id, filename=file.filename or "")
            pg_store = get_pg_store()
            success = 0
            for chunk_text in chunks:
                # Offload the blocking embed (sync httpx → in-process llmgw) to
                # a worker thread to avoid deadlocking the event loop.
                vec = await asyncio.to_thread(embedder.embed, chunk_text)
                chunk_id = hybrid.add(doc_id, chunk_text, vec, {"filename": file.filename or ""})
                graph.insert(chunk_text, doc_id, {"filename": file.filename or ""})
                lightrag.insert(chunk_text, doc_id, {"filename": file.filename or ""})
                # Write to PG for BM25 search (idempotent upsert by chunk_id).
                if pg_store is not None:
                    try:
                        pg_store.save_chunk(
                            chunk_id, doc_id, chunk_text,
                            {"filename": file.filename or "", "tenant_id": tenant_id},
                        )
                    except Exception:
                        pass
                success += 1
            mark_indexed(tenant_id, doc_id, success)
            # Hook 3 of 5: emit document-uploaded event.
            _emit(
                request, "rag.document.uploaded", doc_id,
                {
                    "document_id": doc_id,
                    "filename": file.filename or "",
                    "size_bytes": len(raw),
                    "chunks": success,
                },
                tenant_id,
            )
            return UploadResponse(
                document_id=doc_id,
                filename=file.filename or "",
                size_bytes=len(raw),
                chunk_count=success,
                indexed_in=["hybrid", "graph", "lightrag"] if success else [],
            )
        except HTTPException:
            raise
        except Exception as exc:
            if 'doc_id' in locals():
                from mate_tech_rag.api.document_registry import mark_failed
                mark_failed(tenant_id, doc_id, str(exc))
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/rag/ingest", response_model=IngestResponse)
    async def ingest_endpoint(request: Request, req: IngestRequest) -> IngestResponse:  # pyright: ignore[reportUnusedFunction]
        _require_ctx(request)
        require_tenant(request.state.ctx)
        tenant_id = str(request.state.ctx.tenant_id)
        try:
            # Offload the sync ingest (which does blocking embed calls to the
            # in-process llmgw /embeddings) to a worker thread so the async
            # event loop is not blocked → otherwise deadlock/timeout.
            result = await asyncio.to_thread(ingest, req, tenant_id=tenant_id)
            # Hook 3 of 5: emit document-ingested event.
            _emit(
                request, "rag.document.ingested", req.document_id,
                {
                    "document_id": req.document_id,
                    "chunks": result.chunk_count,
                    "total": result.total_chunks,
                },
                tenant_id,
            )
            return result
        except ValueError as exc:
            # Chunk validation failure -> 400 (not 500).
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/rag/search", response_model=RetrievalResponse)
    async def search(request: Request, req: RetrievalRequest) -> RetrievalResponse:  # pyright: ignore[reportUnusedFunction]
        _require_ctx(request)
        require_tenant(request.state.ctx)
        tenant_id = str(request.state.ctx.tenant_id)
        user_id = str(getattr(request.state.ctx, "user_id", "anonymous"))
        with journey_span(
            "rag.retrieve",
            tenant_id=tenant_id,
            user_id=user_id,
            attributes={"rag.top_k": req.top_k, "rag.mode": req.mode},
        ):
            try:
                result = await asyncio.to_thread(retrieve, req)
                # Tenant-scoped hit filtering: only return hits from documents
                # owned by this tenant (ADR-0014 cross-tenant isolation).
                owned = tenant_document_ids(tenant_id)
                if owned:
                    filtered = [h for h in result.hits if h.document_id in owned]
                else:
                    filtered = []
                # metadata_filter: keep only hits whose metadata matches all
                # key-value pairs in the filter (task 3).
                if req.metadata_filter:
                    filtered = [
                        h for h in filtered
                        if all(h.metadata.get(k) == v for k, v in req.metadata_filter.items())
                    ]
                # Reranker: second-pass reordering of filtered hits (task 2).
                reranker = create_reranker(req.rerank_strategy)
                hit_map = {h.chunk_id: h for h in filtered}
                candidates = [
                    RerankCandidate(
                        chunk_id=h.chunk_id,
                        text=h.text,
                        score=h.score,
                        metadata=dict(h.metadata),
                    )
                    for h in filtered
                ]
                reranked = reranker.rerank(req.query, candidates, req.top_k)
                reranked_hits = [
                    ChunkHit(
                        chunk_id=c.chunk_id,
                        document_id=hit_map[c.chunk_id].document_id,
                        score=c.score,
                        text=c.text,
                        metadata=hit_map[c.chunk_id].metadata,
                    )
                    for c in reranked
                ]
                filtered_resp = RetrievalResponse(
                    query=result.query,
                    hits=reranked_hits,
                    total=len(reranked_hits),
                    latency_ms=result.latency_ms,
                    mode=result.mode,
                )
                # Hook 3 of 5: emit search-executed event.
                _emit(
                    request, "rag.search.executed", req.query[:64],
                    {
                        "query": req.query[:200],
                        "top_k": req.top_k,
                        "mode": result.mode,
                        "hits": len(reranked_hits),
                        "total_indexed": len(owned),
                    },
                    tenant_id,
                )
                return filtered_resp
            except Exception as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.get("/api/v1/rag/stats", response_model=StatsResponse)
    async def stats(request: Request) -> StatsResponse:  # pyright: ignore[reportUnusedFunction]
        _require_ctx(request)
        require_tenant(request.state.ctx)
        return StatsResponse(
            total_chunks=get_hybrid().count(),
            embedder_dim=get_embedder().dim,
        )

    @app.get("/api/v1/rag/admin/pg-stats", response_model=PgStatsResponse)
    async def pg_stats(request: Request) -> PgStatsResponse:  # pyright: ignore[reportUnusedFunction]
        _require_ctx(request)
        require_tenant(request.state.ctx)
        store = get_pg_store()
        if store is None:
            return PgStatsResponse(
                available=False,
                chunks_count=0,
                dsn_host="(PG not initialized; set RAG_MODE=hybrid|full)",
            )
        dsn = os.environ.get("PG_DSN", "")
        host = dsn.split("@")[-1] if "@" in dsn else ""
        return PgStatsResponse(
            available=store.is_available(),
            chunks_count=store.count(),
            dsn_host=host,
        )

    return app


# Initialize real clients per env (RAG_MODE=memory|hybrid|graph|full)
try:
    init_real_clients()
except Exception as exc:
    _log.warning("init_real_clients failed: %s", exc)

app = create_app()
