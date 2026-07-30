"""FastAPI app for mate-app-kb (business aggregation facade).

Wires the three integration hooks per ADR-0014:
  1. install_auth(app) from mate_platform.auth (SEC-IAM-01).
  2. require_tenant(ctx) at the top of every handler (SEC-TENANT-01).
  3. (future) outbox.append(event) for write endpoints (PLATFORM-EVENT-01).

The RAGClient / AgentClient are constructed lazily per-request from
the request's RequestContext so the X-Tenant-Id header is bound to
the verified tenant.
"""
from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from mate_app_kb import __version__
from mate_app_kb.api.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    SearchRequest,
    SearchResponse,
    StatsResponse,
    UploadResponse,
)
from mate_app_kb.clients import AgentClient, RAGClient

from mate_platform.auth import install_auth
from mate_platform.tenancy.guards import require_tenant


_log = logging.getLogger(__name__)


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
    async def healthz() -> HealthResponse:
        return HealthResponse(status="ok", service="mate-app-kb", version=__version__)

    @app.post("/api/v1/app-kb/upload", response_model=UploadResponse)
    async def upload(
        request: Request,
        file: UploadFile = File(...),
        document_id: str | None = None,
    ) -> UploadResponse:
        # Hook 2 of 3: require a tenant binding.
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
            return UploadResponse(
                document_id=data.get("document_id", doc_id),
                filename=data.get("filename", file.filename or ""),
                size_bytes=data.get("size_bytes", len(raw)),
                chunk_count=data.get("chunk_count", 0),
                indexed_in=data.get("indexed_in", []),
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc

    @app.post("/api/v1/app-kb/search", response_model=SearchResponse)
    async def search(request: Request, req: SearchRequest) -> SearchResponse:
        # Hook 2: tenant guard.
        ctx = _require_ctx(request)
        require_tenant(ctx)
        start = time.perf_counter()
        try:
            data = _rag(request).search(req.query, top_k=req.top_k, mode=req.mode)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        latency_ms = int((time.perf_counter() - start) * 1000)
        return SearchResponse(
            query=data.get("query", req.query),
            mode=data.get("mode", req.mode),
            total=data.get("total", 0),
            hits=data.get("hits", []),
            latency_ms=latency_ms,
        )

    @app.post("/api/v1/app-kb/chat", response_model=ChatResponse)
    async def chat(request: Request, req: ChatRequest) -> ChatResponse:
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

    @app.post("/api/v1/app-kb/chat/stream")
    async def chat_stream(request: Request, req: ChatRequest):
        ctx = _require_ctx(request)
        require_tenant(ctx)

        async def event_gen():
            for line in _agent(request).stream_chat(
                req.message, scenario=req.scenario, thread_id=req.thread_id
            ):
                yield line + "\n\n"
        return StreamingResponse(event_gen(), media_type="text/event-stream")

    @app.get("/api/v1/app-kb/stats", response_model=StatsResponse)
    async def stats(request: Request) -> StatsResponse:
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

    return app


app = create_app()