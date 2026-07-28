"""FastAPI app for mate-app-kb (business aggregation facade)."""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
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

_log = logging.getLogger(__name__)


def create_app(rag: RAGClient | None = None, agent: AgentClient | None = None) -> FastAPI:
    app = FastAPI(
        title="mate-app-kb",
        version=__version__,
        description="Mate Platform business aggregation service (RAG + Agent facade)",
    )
    if rag is None:
        rag = RAGClient()
    if agent is None:
        agent = AgentClient()

    @app.get("/healthz", response_model=HealthResponse)
    async def healthz() -> HealthResponse:
        return HealthResponse(status="ok", service="mate-app-kb", version=__version__)

    @app.post("/api/v1/app-kb/upload", response_model=UploadResponse)
    async def upload(file: UploadFile = File(...), document_id: str | None = None) -> UploadResponse:
        try:
            raw = await file.read()
            if not raw:
                raise HTTPException(status_code=400, detail="empty file")
            doc_id = document_id or str(uuid.uuid4())
            data = rag.upload(raw, file.filename or "unknown", doc_id, file.content_type or "text/plain")
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
    async def search(req: SearchRequest) -> SearchResponse:
        start = time.perf_counter()
        try:
            data = rag.search(req.query, top_k=req.top_k, mode=req.mode)
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
    async def chat(req: ChatRequest) -> ChatResponse:
        start = time.perf_counter()
        try:
            data = agent.chat(req.message, scenario=req.scenario, thread_id=req.thread_id)
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
    async def chat_stream(req: ChatRequest):
        async def event_gen():
            for line in agent.stream_chat(req.message, scenario=req.scenario, thread_id=req.thread_id):
                yield line + "\n\n"
        return StreamingResponse(event_gen(), media_type="text/event-stream")

    @app.get("/api/v1/app-kb/stats", response_model=StatsResponse)
    async def stats() -> StatsResponse:
        try:
            data = rag.stats()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        return StatsResponse(
            total_chunks=data.get("total_chunks", 0),
            embedder_dim=data.get("embedder_dim", 0),
        )

    return app


app = create_app()