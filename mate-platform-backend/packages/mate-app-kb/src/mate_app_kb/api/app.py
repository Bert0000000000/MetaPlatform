"""FastAPI app for mate-app-kb (business aggregation facade).

Wires the three integration hooks per ADR-0014:
  1. install_auth(app) from mate_platform.auth (SEC-IAM-01).
  2. require_tenant(ctx) at the top of every handler (SEC-TENANT-01).
  3. (future) outbox.append(event) for write endpoints (PLATFORM-EVENT-01).

The RAGClient / AgentClient are constructed lazily per-request from
the request's RequestContext so the X-Tenant-Id header is bound to
the verified tenant.

Path alignment (P0 close-out, 2026-07-30):
  - Canonical prefix is now `/api/v1/kb/*` to match the spec
    (contracts/openapi/services/kb.yaml + platform.yaml).
  - The legacy `/api/v1/app-kb/*` paths remain as DEPRECATED
    aliases for one release; they return the same handler results
    but emit a Deprecation response header. Consumers must migrate
    before the next minor release (see API-GOV-01 §6).
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import StreamingResponse

from mate_app_kb import __version__
from mate_app_kb.api.schemas import (
    ChatRequest,
    ChatResponse,
    CollectionCreateRequest,
    CollectionResponse,
    DocumentResponse,
    DocumentTransitionRequest,
    HealthResponse,
    RetrievalConfigResponse,
    RetrievalConfigUpdate,
    SearchLogResponse,
    SearchRequest,
    SearchResponse,
    StatsResponse,
    UploadResponse,
)
from mate_app_kb.clients import AgentClient, RAGClient
from mate_app_kb.repositories.in_memory import (
    KbCollection,
    KbDocument,
    KbRetrievalConfig,
    KbRetrievalConfigSnapshot,
    KbSearchLog,
    delete_collection,
    delete_document,
    get_collection,
    get_document,
    get_retrieval_config,
    list_collections,
    list_documents,
    list_retrieval_config_snapshots,
    list_search_logs,
    put_collection,
    put_document,
    put_retrieval_config,
    put_retrieval_config_snapshot,
    put_search_log,
)
from mate_platform.auth import install_auth
from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import TenantId
from mate_platform.tenancy.guards import require_tenant

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Document lifecycle state machine (BUSINESS-SLICES deep implementation)
# ---------------------------------------------------------------------------
# Allowed transitions:
#   uploaded  -> indexing  (parser picked up the document)
#   indexing  -> indexed   (chunks persisted, searchable)
#   indexing  -> failed    (validation / parse error)
#   indexed   -> archived  (soft-delete from active search)
# Any other transition is rejected with HTTP 409.
_DOC_TRANSITIONS: dict[str, frozenset[str]] = {
    "uploaded": frozenset({"indexing"}),
    "indexing": frozenset({"indexed", "failed"}),
    "indexed": frozenset({"archived"}),
    "failed": frozenset({"indexing"}),
    "archived": frozenset(),
}

_VALID_SEARCH_MODES = frozenset({"AUTO", "FACTUAL", "ENTITY", "THEMATIC"})


# PATCH fix 4 (CJK tokenization): inline copy of the
# ``mate_tech_rag.tokenize.tokenize_for_match`` CJK-bigram tokenizer so
# the kb facade can score Chinese keyword overlap without taking a hard
# cross-package dependency on mate-tech-rag. See the source file for the
# canonical implementation and a refactor plan: lift this to
# ``mate_common.tokenize`` once it stabilises.
import re as _re  # local alias to keep the module-level import block tidy.

_WORD_RE = _re.compile(r"[0-9A-Za-z]+")
_CJK_RUN_RE = _re.compile(r"[㐀-䶿一-鿿豈-﫿]+")


def _tokenize_for_match(text: str) -> set[str]:
    """CJK-aware bag-of-words (Latin words + CJK bigrams).

    Duplicates ``mate_tech_rag.tokenize.tokenize_for_match`` so the kb
    facade can run keyword-overlap scoring for Chinese queries without
    pulling in mate-tech-rag as a runtime dependency.
    """
    tokens: set[str] = set()
    tokens.update(w.lower() for w in _WORD_RE.findall(text))
    for run in _CJK_RUN_RE.findall(text):
        if len(run) == 1:
            tokens.add(run)
        else:
            tokens.update(run[i : i + 2] for i in range(len(run) - 1))
    return tokens


# Standard deprecation header (RFC 8594). The legacy prefix
# /api/v1/app-kb/* is the deprecated alias of /api/v1/kb/*.
_DEPRECATION_HEADER_VALUE = 'true; target="/api/v1/kb"'


def create_app(rag: RAGClient | None = None, agent: AgentClient | None = None) -> FastAPI:
    app = FastAPI(
        title="mate-app-kb",
        version=__version__,
        description="Mate Platform business aggregation service (RAG + Agent facade)",
    )
    # Hook 1 of 3: install the auth middleware (SEC-IAM-01).
    # After this call, every incoming request has request.state.ctx
    # populated with a verified RequestContext (or a 401/403 response
    # was returned).
    install_auth(app)
    # Hook 3 of 5: default outbox writer (no-op until a test attaches one).
    if not hasattr(app.state, "outbox_writer"):
        app.state.outbox_writer = InMemoryOutboxWriter()

    # Handlers for /healthz are anonymous (the middleware already
    # whitelists them); nothing to do for them beyond the AppConfig.

    def _require_ctx(request: Request):
        """Return ctx, raising if missing (defence in depth)."""
        ctx = getattr(request.state, "ctx", None)
        if ctx is None:
            # This should never happen because install_auth populates
            # ctx or returns 401; the check is a safety net.
            raise HTTPException(status_code=401, detail="no auth context")
        return ctx

    def _tid(request: Request) -> str:
        """Return the verified tenant_id for the current request."""
        return str(require_tenant(_require_ctx(request)))

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

    def _now_iso() -> str:
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def _score_hits(hits: list[dict], query: str) -> list[dict]:
        """Apply retrieval scoring rules to search hits.

        - Normalises ``score`` to [0, 1] when the upstream provides
          a raw score.
        - Deduplicates by ``document_id`` keeping the highest score.
        - Sorts by score descending.

        PATCH fix 4: keyword overlap uses the CJK-aware
        ``mate_tech_rag.tokenize.tokenize_for_match`` (a copy of the
        CJK-bigram implementation lives inline so this package does not
        gain a hard cross-package dependency on mate-tech-rag). Under the
        previous ``str.split()`` tokenisation the whole CJK run collapsed
        into a single token, the overlap was 0, and the boost never
        applied to Chinese queries.
        """
        if not hits:
            return []
        q_terms = _tokenize_for_match(query)
        best_per_doc: dict[str, dict] = {}
        for h in hits:
            doc_id = h.get("document_id", h.get("id", ""))
            raw = h.get("score", 0.0)
            try:
                raw_f = float(raw)
            except (TypeError, ValueError):
                raw_f = 0.0
            # Keyword overlap boost: if the chunk text contains query
            # terms, bump the normalised score.
            text = (h.get("text", "") or h.get("content", ""))
            t_terms = _tokenize_for_match(text)
            overlap = len(q_terms & t_terms) if q_terms else 0
            overlap_boost = min(overlap * 0.05, 0.2)
            norm = min(max(raw_f, 0.0) + overlap_boost, 1.0) if raw_f > 0 else overlap_boost
            h_copy = dict(h)
            h_copy["score"] = round(norm, 4)
            existing = best_per_doc.get(doc_id)
            if existing is None or h_copy["score"] > existing["score"]:
                best_per_doc[doc_id] = h_copy
        return sorted(best_per_doc.values(), key=lambda x: x["score"], reverse=True)

    def _rag(request: Request) -> RAGClient:
        ctx = _require_ctx(request)
        if rag is None:
            # Lazily construct with auth + tenant; we re-use the
            # middleware-installed auth config via the app state.
            c = RAGClient(
                auth=app.state.service_identity,
                tenant_id=ctx.tenant_id,
            )
            return c
        # Reuse injected client; rebind its tenant to the request.
        rag.set_tenant(ctx.tenant_id)
        return rag

    def _agent(request: Request) -> AgentClient:
        ctx = _require_ctx(request)
        if agent is None:
            c = AgentClient(
                auth=app.state.service_identity,
                tenant_id=ctx.tenant_id,
            )
            return c
        agent.set_tenant(ctx.tenant_id)
        return agent

    @app.get("/healthz", response_model=HealthResponse)
    async def healthz() -> HealthResponse:  # pyright: ignore[reportUnusedFunction]
        return HealthResponse(status="ok", service="mate-app-kb", version=__version__)

    @app.post("/api/v1/kb/upload", response_model=UploadResponse)
    async def upload(  # pyright: ignore[reportUnusedFunction]
        request: Request,
        file: UploadFile = File(...),
        document_id: str | None = None,
        collection_id: str | None = None,
    ) -> UploadResponse:
        # Hook 2 of 3: require a tenant binding.
        tid = _tid(request)
        try:
            raw = await file.read()
            if not raw:
                raise HTTPException(status_code=400, detail="empty file")
            doc_id = document_id or str(uuid.uuid4())
            # Register the document in the local store with lifecycle
            # status "uploaded" before delegating to the RAG upstream.
            now = _now_iso()
            col_id = collection_id or ""
            if col_id:
                col = get_collection(tid, col_id)
                if col is None:
                    raise HTTPException(
                        status_code=404, detail=f"collection {col_id} not found"
                    )
            local_doc = KbDocument(
                id=doc_id,
                tenant_id=tid,
                collection_id=col_id,
                document_id=doc_id,
                filename=file.filename or "unknown",
                size_bytes=len(raw),
                chunk_count=0,
                status="uploaded",
                metadata={"source": "upload", "content_type": file.content_type or ""},
                created_at=now,
                updated_at=now,
            )
            put_document(tid, local_doc)
            _emit(
                request, "kb.document.uploaded", doc_id,
                {"document_id": doc_id, "filename": file.filename or "",
                 "size_bytes": len(raw), "collection_id": col_id},
                tid,
            )
            try:
                data = _rag(request).upload(
                    raw, file.filename or "unknown", doc_id, file.content_type or "text/plain"
                )
            except Exception:
                # Mark the document as failed if the upstream errors.
                failed_doc = KbDocument(
                    id=doc_id, tenant_id=tid, collection_id=col_id,
                    document_id=doc_id, filename=file.filename or "unknown",
                    size_bytes=len(raw), chunk_count=0, status="failed",
                    metadata={"source": "upload", "error": "upstream failure"},
                    created_at=now, updated_at=_now_iso(),
                )
                put_document(tid, failed_doc)
                raise
            chunk_count = data.get("chunk_count", 0)
            # Transition uploaded -> indexed on successful upstream ingest.
            indexed_doc = KbDocument(
                id=doc_id, tenant_id=tid, collection_id=col_id,
                document_id=doc_id, filename=file.filename or "unknown",
                size_bytes=data.get("size_bytes", len(raw)),
                chunk_count=chunk_count, status="indexed",
                metadata={"source": "upload", "indexed_in": data.get("indexed_in", [])},
                created_at=now, updated_at=_now_iso(),
            )
            put_document(tid, indexed_doc)
            _emit(
                request, "kb.document.indexed", doc_id,
                {"document_id": doc_id, "chunks": chunk_count, "status": "indexed"},
                tid,
            )
            return UploadResponse(
                document_id=data.get("document_id", doc_id),
                filename=data.get("filename", file.filename or ""),
                size_bytes=data.get("size_bytes", len(raw)),
                chunk_count=chunk_count,
                indexed_in=data.get("indexed_in", []),
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc

    @app.post("/api/v1/kb/search", response_model=SearchResponse)
    async def search(request: Request, req: SearchRequest) -> SearchResponse:  # pyright: ignore[reportUnusedFunction]
        # Hook 2: tenant guard.
        tid = _tid(request)
        start = time.perf_counter()
        # Apply the tenant's saved retrieval config as defaults: an explicit
        # rerank_strategy on the request wins, otherwise the configured one.
        cfg = get_retrieval_config(tid)
        rerank = req.rerank_strategy or cfg.rerank_strategy
        try:
            data = _rag(request).search(
                req.query, top_k=req.top_k, mode=req.mode, rerank_strategy=rerank,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        latency_ms = int((time.perf_counter() - start) * 1000)
        # Apply retrieval scoring: normalise, dedupe by document, sort.
        raw_hits = data.get("hits", [])
        scored = _score_hits(raw_hits, req.query)
        # Write a search audit log entry (BUSINESS-SLICES deep).
        log_id = f"log-{uuid.uuid4().hex[:8]}"
        put_search_log(tid, KbSearchLog(
            id=log_id, tenant_id=tid, query=req.query[:200],
            mode=req.mode, total_hits=len(scored), latency_ms=latency_ms,
            created_at=_now_iso(),
        ))
        _emit(
            request, "kb.search.executed", req.query[:64],
            {"query": req.query[:200], "mode": req.mode, "hits": len(scored),
             "latency_ms": latency_ms},
            tid,
        )
        return SearchResponse(
            query=data.get("query", req.query),
            mode=data.get("mode", req.mode),
            total=len(scored),
            hits=scored,
            latency_ms=latency_ms,
        )

    @app.post("/api/v1/kb/chat", response_model=ChatResponse)
    async def chat(request: Request, req: ChatRequest) -> ChatResponse:  # pyright: ignore[reportUnusedFunction]
        ctx = _require_ctx(request)
        require_tenant(ctx)
        start = time.perf_counter()
        try:
            data = _agent(request).chat(req.message, scenario=req.scenario, thread_id=req.thread_id)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        latency_ms = int((time.perf_counter() - start) * 1000)
        return ChatResponse(
            thread_id=data.get("thread_id", ""),
            scenario=data.get("scenario", req.scenario),
            answer=data.get("answer", ""),
            retrieved_chunks=data.get("retrieved_chunks", []),
            tool_calls=data.get("tool_calls", []),
            latency_ms=latency_ms,
        )

    @app.post("/api/v1/kb/chat/stream")
    async def chat_stream(request: Request, req: ChatRequest):  # pyright: ignore[reportUnusedFunction]
        ctx = _require_ctx(request)
        require_tenant(ctx)

        async def event_gen():
            for line in _agent(request).stream_chat(
                req.message, scenario=req.scenario, thread_id=req.thread_id
            ):
                yield line + "\n\n"
        return StreamingResponse(event_gen(), media_type="text/event-stream")

    @app.get("/api/v1/kb/stats", response_model=StatsResponse)
    async def stats(request: Request) -> StatsResponse:  # pyright: ignore[reportUnusedFunction]
        ctx = _require_ctx(request)
        require_tenant(ctx)
        try:
            data = _rag(request).stats()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        return StatsResponse(
            total_chunks=data.get("total_chunks", 0),
            embedder_dim=data.get("embedder_dim", 0),
        )

    # ------------------------------------------------------------------
    # BUSINESS-SLICES deep: Collection CRUD
    # ------------------------------------------------------------------
    @app.get("/api/v1/kb/collections", response_model=list[CollectionResponse])
    async def list_cols(request: Request) -> list[CollectionResponse]:  # pyright: ignore[reportUnusedFunction]
        tid = _tid(request)
        return [CollectionResponse(**asdict(c)) for c in list_collections(tid)]

    @app.post("/api/v1/kb/collections", response_model=CollectionResponse, status_code=201)
    async def create_col(  # pyright: ignore[reportUnusedFunction]
        request: Request, req: CollectionCreateRequest,
    ) -> CollectionResponse:
        tid = _tid(request)
        cid = f"col-{uuid.uuid4().hex[:8]}"
        now = _now_iso()
        col = KbCollection(
            id=cid, tenant_id=tid, name=req.name, description=req.description,
            document_count=0, status="active", config=req.config,
            created_at=now, updated_at=now,
        )
        put_collection(tid, col)
        _emit(
            request, "kb.collection.created", cid,
            {"collection_id": cid, "name": req.name}, tid,
        )
        return CollectionResponse(**asdict(col))

    @app.get("/api/v1/kb/collections/{cid}", response_model=CollectionResponse)
    async def get_col(  # pyright: ignore[reportUnusedFunction]
        request: Request, cid: str,
    ) -> CollectionResponse:
        tid = _tid(request)
        col = get_collection(tid, cid)
        if col is None:
            raise HTTPException(status_code=404, detail="collection not found")
        return CollectionResponse(**asdict(col))

    @app.delete("/api/v1/kb/collections/{cid}")
    async def delete_col(  # pyright: ignore[reportUnusedFunction]
        request: Request, cid: str,
    ) -> dict:  # pyright: ignore[reportUnusedFunction]
        tid = _tid(request)
        col = get_collection(tid, cid)
        if col is None:
            raise HTTPException(status_code=404, detail="collection not found")
        delete_collection(tid, cid)
        _emit(
            request, "kb.collection.deleted", cid,
            {"collection_id": cid}, tid,
        )
        return {"deleted": cid}

    # ------------------------------------------------------------------
    # Retrieval configuration (knowledge/config page)
    # ------------------------------------------------------------------
    @app.get("/api/v1/kb/retrieval-config", response_model=RetrievalConfigResponse)
    async def get_retrieval_cfg(  # pyright: ignore[reportUnusedFunction]
        request: Request,
    ) -> RetrievalConfigResponse:
        tid = _tid(request)
        cfg = get_retrieval_config(tid)
        return RetrievalConfigResponse(**asdict(cfg))

    @app.put("/api/v1/kb/retrieval-config", response_model=RetrievalConfigResponse)
    async def put_retrieval_cfg(  # pyright: ignore[reportUnusedFunction]
        request: Request, req: RetrievalConfigUpdate,
    ) -> RetrievalConfigResponse:
        tid = _tid(request)
        existing = get_retrieval_config(tid)
        # P1.8: snapshot the prior version BEFORE saving the new one. The
        # snapshot only records state for tenants that have already saved
        # at least once (their first save has nothing to snapshot).
        prior_snapshots = list_retrieval_config_snapshots(tid)
        next_version = (existing.version + 1) if prior_snapshots or existing.version > 1 else 2
        # If the existing record was never customised (still version=1 but
        # the defaults), only start snapshotting from the FIRST user-saved
        # config: detect that case by checking if the snapshot list is empty
        # AND existing.version == 1 and existing.updated_at is blank.
        if not prior_snapshots and existing.version == 1 and not existing.updated_at:
            # The first user-save becomes version=2 with no prior snapshot.
            cfg_version = 2
        else:
            cfg_version = next_version
        if existing.updated_at:
            snapshot = KbRetrievalConfigSnapshot(
                id=f"{tid}:{existing.version}",
                tenant_id=tid,
                version=existing.version,
                mode=existing.mode,
                rerank_strategy=existing.rerank_strategy,
                top_k=existing.top_k,
                similarity_threshold=existing.similarity_threshold,
                chunk_strategy=existing.chunk_strategy,
                chunk_size=existing.chunk_size,
                chunk_overlap=existing.chunk_overlap,
                vector_weight=existing.vector_weight,
                keyword_weight=existing.keyword_weight,
                reranker_enabled=existing.reranker_enabled,
                show_citations=existing.show_citations,
                snapshot_at=_now_iso(),
            )
            put_retrieval_config_snapshot(tid, snapshot)
        cfg = KbRetrievalConfig(
            tenant_id=tid,
            mode=req.mode,
            rerank_strategy=req.rerank_strategy,
            top_k=req.top_k,
            similarity_threshold=req.similarity_threshold,
            chunk_strategy=req.chunk_strategy,
            chunk_size=req.chunk_size,
            chunk_overlap=req.chunk_overlap,
            vector_weight=req.vector_weight,
            keyword_weight=req.keyword_weight,
            reranker_enabled=req.reranker_enabled,
            show_citations=req.show_citations,
            version=cfg_version,
            updated_at=_now_iso(),
        )
        put_retrieval_config(tid, cfg)
        _emit(
            request, "kb.retrieval-config.updated", tid,
            {"rerank_strategy": cfg.rerank_strategy, "mode": cfg.mode,
             "top_k": cfg.top_k, "chunk_strategy": cfg.chunk_strategy,
             "version": cfg.version},
            tid,
        )
        _ = existing  # retained for clarity: we replace the prior config
        return RetrievalConfigResponse(**asdict(cfg))

    # ------------------------------------------------------------------
    # P1.8: retrieval-config history (read-only — rollback not in scope)
    # ------------------------------------------------------------------
    @app.get("/api/v1/kb/retrieval-config/history", response_model=list[dict])
    async def list_retrieval_cfg_history(  # pyright: ignore[reportUnusedFunction]
        request: Request, limit: int | None = None,
    ) -> list[dict]:
        tid = _tid(request)
        snapshots = list_retrieval_config_snapshots(tid, limit=limit)
        return [asdict(s) for s in snapshots]

    # ------------------------------------------------------------------
    # BUSINESS-SLICES deep: Document management + lifecycle
    # ------------------------------------------------------------------
    @app.get("/api/v1/kb/documents", response_model=list[DocumentResponse])
    async def list_docs(  # pyright: ignore[reportUnusedFunction]
        request: Request,
        collection_id: str | None = None,
        status: str | None = None,
    ) -> list[DocumentResponse]:
        tid = _tid(request)
        docs = list_documents(tid)
        if collection_id:
            docs = [d for d in docs if d.collection_id == collection_id]
        if status:
            docs = [d for d in docs if d.status == status]
        return [DocumentResponse(**asdict(d)) for d in docs]

    @app.get("/api/v1/kb/documents/{did}", response_model=DocumentResponse)
    async def get_doc(  # pyright: ignore[reportUnusedFunction]
        request: Request, did: str,
    ) -> DocumentResponse:
        tid = _tid(request)
        doc = get_document(tid, did)
        if doc is None:
            raise HTTPException(status_code=404, detail="document not found")
        return DocumentResponse(**asdict(doc))

    @app.patch("/api/v1/kb/documents/{did}/status", response_model=DocumentResponse)
    async def transition_doc(  # pyright: ignore[reportUnusedFunction]
        request: Request, did: str, req: DocumentTransitionRequest,
    ) -> DocumentResponse:
        tid = _tid(request)
        doc = get_document(tid, did)
        if doc is None:
            raise HTTPException(status_code=404, detail="document not found")
        current = doc.status
        allowed = _DOC_TRANSITIONS.get(current, frozenset())
        if req.status not in allowed:
            raise HTTPException(
                status_code=409,
                detail=f"invalid transition: {current} -> {req.status}",
            )
        now = _now_iso()
        meta = dict(doc.metadata)
        if req.error:
            meta["error"] = req.error
        updated = KbDocument(
            id=doc.id, tenant_id=tid, collection_id=doc.collection_id,
            document_id=doc.document_id, filename=doc.filename,
            size_bytes=doc.size_bytes,
            chunk_count=req.chunk_count if req.chunk_count is not None else doc.chunk_count,
            status=req.status, metadata=meta,
            created_at=doc.created_at, updated_at=now,
        )
        put_document(tid, updated)
        _emit(
            request, "kb.document.transitioned", did,
            {"document_id": did, "from": current, "to": req.status}, tid,
        )
        return DocumentResponse(**asdict(updated))

    @app.delete("/api/v1/kb/documents/{did}")
    async def delete_doc(  # pyright: ignore[reportUnusedFunction]
        request: Request, did: str,
    ) -> dict:  # pyright: ignore[reportUnusedFunction]
        """P1.7 RAG 增强: cascade-delete doc from KB catalog AND RAG.

        Steps (mirrors mate-tech-dw /documents/{id}):
          1. Verify the requester has a tenant context (ADR-0014 / hard rule 3).
          2. Look up the local KB catalog row; 404 if missing.
          3. Cascade-delete from the upstream RAG service so the vector /
             graph / lightrag / PG indexes stop returning hits for this doc.
             (In single-process dev mode: ``app.state.rag_admin_url`` may
             carry the upstream base; if missing we fall back to a direct
             in-process call via ``mate_tech_rag.api.cascade``.)
          4. Drop the local KB catalog row.
          5. Emit ``kb.document.deleted`` for downstream consumers.
        """
        tid = _tid(request)
        doc = get_document(tid, did)
        if doc is None:
            raise HTTPException(status_code=404, detail="document not found")
        # Cascade-delete from the upstream RAG service. The whole point
        # of this endpoint is to clear hybrid / graph / lightrag / PG
        # chunks so subsequent /search returns 0 hits for this doc.
        rag_client = _rag(request)
        rag_outcome: dict = {"deleted": False, "document_id": did}
        rag_error: str | None = None
        try:
            # The RAGClient exposes a delete_document method via the
            # service-to-service HTTP path. In single-process dev the
            # upstream is the in-process ``mate_tech_rag`` FastAPI app;
            # we fall back to a direct call for that mode.
            if hasattr(rag_client, "delete_document"):
                rag_outcome = rag_client.delete_document(did)
            else:
                try:
                    from mate_tech_rag.api.cascade import delete_document_cascade

                    res = delete_document_cascade(tid, did)
                    rag_outcome = res.as_dict()
                except ImportError:  # pragma: no cover — keep cascade best-effort
                    rag_outcome = {"deleted": False, "document_id": did}
        except Exception as exc:  # noqa: BLE001 — best-effort cascade
            rag_error = str(exc)
        delete_document(tid, did)
        _emit(
            request, "kb.document.deleted", did,
            {"document_id": did, "rag_deleted": bool(rag_outcome.get("deleted")),
             "rag_error": rag_error},
            tid,
        )
        return {"deleted": did, "rag": rag_outcome, "rag_error": rag_error}

    # ------------------------------------------------------------------
    # BUSINESS-SLICES deep: Search audit log
    # ------------------------------------------------------------------
    @app.get("/api/v1/kb/search/logs", response_model=list[SearchLogResponse])
    async def list_search_logs_ep(  # pyright: ignore[reportUnusedFunction]
        request: Request,
    ) -> list[SearchLogResponse]:
        tid = _tid(request)
        return [SearchLogResponse(**asdict(l)) for l in list_search_logs(tid)]

    # ------------------------------------------------------------------
    # Deprecated aliases: /api/v1/app-kb/*  (P0 close-out 2026-07-30)
    # The canonical prefix above is /api/v1/kb/*. The legacy endpoints
    # remain available for one release to give consumers time to migrate;
    # they emit the RFC 8594 Deprecation response header pointing at the
    # new path. Remove in the release after consumers flip.
    # ------------------------------------------------------------------
    async def _deprecated_upload(
        request: Request,
        file: UploadFile = File(...),
        document_id: str | None = None,
    ) -> Response:
        ctx = _require_ctx(request)
        require_tenant(ctx)
        try:
            raw = await file.read()
            if not raw:
                raise HTTPException(status_code=400, detail="empty file")
            doc_id = document_id or str(uuid.uuid4())
            data = _rag(request).upload(
                raw, file.filename or "unknown", doc_id, file.content_type or "text/plain"
            )
            body = UploadResponse(
                document_id=data.get("document_id", doc_id),
                filename=data.get("filename", file.filename or ""),
                size_bytes=data.get("size_bytes", len(raw)),
                chunk_count=data.get("chunk_count", 0),
                indexed_in=data.get("indexed_in", []),
            ).model_dump()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        return Response(
            content=__import__("json").dumps(body),
            media_type="application/json",
            headers={"Deprecation": _DEPRECATION_HEADER_VALUE},
        )

    async def _deprecated_search(request: Request, req: SearchRequest) -> Response:
        ctx = _require_ctx(request)
        require_tenant(ctx)
        start = time.perf_counter()
        try:
            data = _rag(request).search(req.query, top_k=req.top_k, mode=req.mode)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        latency_ms = int((time.perf_counter() - start) * 1000)
        body = SearchResponse(
            query=data.get("query", req.query),
            mode=data.get("mode", req.mode),
            total=data.get("total", 0),
            hits=data.get("hits", []),
            latency_ms=latency_ms,
        ).model_dump()
        return Response(
            content=__import__("json").dumps(body),
            media_type="application/json",
            headers={"Deprecation": _DEPRECATION_HEADER_VALUE},
        )

    async def _deprecated_chat(request: Request, req: ChatRequest) -> Response:
        ctx = _require_ctx(request)
        require_tenant(ctx)
        start = time.perf_counter()
        try:
            data = _agent(request).chat(req.message, scenario=req.scenario, thread_id=req.thread_id)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        latency_ms = int((time.perf_counter() - start) * 1000)
        body = ChatResponse(
            thread_id=data.get("thread_id", ""),
            scenario=data.get("scenario", req.scenario),
            answer=data.get("answer", ""),
            retrieved_chunks=data.get("retrieved_chunks", []),
            tool_calls=data.get("tool_calls", []),
            latency_ms=latency_ms,
        ).model_dump()
        return Response(
            content=__import__("json").dumps(body),
            media_type="application/json",
            headers={"Deprecation": _DEPRECATION_HEADER_VALUE},
        )

    async def _deprecated_chat_stream(request: Request, req: ChatRequest) -> Response:
        ctx = _require_ctx(request)
        require_tenant(ctx)
        # Streams cannot trivially wrap with a header; emit Deprecation
        # via the first SSE preamble comment line. Clients consuming the
        # legacy path will see ": deprecation: ..." as the first event.
        from fastapi.responses import StreamingResponse as _StreamingResponse

        async def event_gen():
            yield f": deprecation: {_DEPRECATION_HEADER_VALUE}\n\n"
            for line in _agent(request).stream_chat(
                req.message, scenario=req.scenario, thread_id=req.thread_id
            ):
                yield line + "\n\n"

        return _StreamingResponse(event_gen(), media_type="text/event-stream")

    async def _deprecated_stats(request: Request) -> Response:
        ctx = _require_ctx(request)
        require_tenant(ctx)
        try:
            data = _rag(request).stats()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        body = StatsResponse(
            total_chunks=data.get("total_chunks", 0),
            embedder_dim=data.get("embedder_dim", 0),
        ).model_dump()
        return Response(
            content=__import__("json").dumps(body),
            media_type="application/json",
            headers={"Deprecation": _DEPRECATION_HEADER_VALUE},
        )

    app.add_api_route(
        "/api/v1/app-kb/upload",
        _deprecated_upload,
        methods=["POST"],
        response_model=UploadResponse,
        tags=["kb-deprecated"],
        deprecated=True,
    )
    app.add_api_route(
        "/api/v1/app-kb/search",
        _deprecated_search,
        methods=["POST"],
        response_model=SearchResponse,
        tags=["kb-deprecated"],
        deprecated=True,
    )
    app.add_api_route(
        "/api/v1/app-kb/chat",
        _deprecated_chat,
        methods=["POST"],
        response_model=ChatResponse,
        tags=["kb-deprecated"],
        deprecated=True,
    )
    app.add_api_route(
        "/api/v1/app-kb/chat/stream",
        _deprecated_chat_stream,
        methods=["POST"],
        tags=["kb-deprecated"],
        deprecated=True,
    )
    app.add_api_route(
        "/api/v1/app-kb/stats",
        _deprecated_stats,
        methods=["GET"],
        response_model=StatsResponse,
        tags=["kb-deprecated"],
        deprecated=True,
    )

    return app


app = create_app()
