"""FastAPI app: RAGFlow + Milvus/Neo4j/PG real clients + multipart upload + 3-strategy retrieval."""
from __future__ import annotations

import logging
import os
import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile

from mate_tech_rag import __version__
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

_log = logging.getLogger(__name__)


def _backend_label(client) -> str:
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


def create_app() -> FastAPI:
    app = FastAPI(
        title="mate-tech-rag",
        version=__version__,
        description="Mate Platform RAG: RAGFlow parse + Hybrid(Milvus) + GraphRAG(Neo4j) + LightRAG",
    )

    @app.get("/healthz", response_model=HealthResponse)
    async def healthz() -> HealthResponse:
        return HealthResponse(status="ok", service="mate-tech-rag", version=__version__)

    @app.get("/api/v1/rag/status", response_model=SystemStatus)
    async def status() -> SystemStatus:
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
    async def parse_endpoint(req: ParseRequest) -> ParseResponse:
        try:
            return parse_document(req)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/rag/upload", response_model=UploadResponse)
    async def upload_endpoint(
        file: UploadFile = File(..., description="text/markdown file to ingest"),
        document_id: str | None = None,
    ) -> UploadResponse:
        try:
            raw = await file.read()
            if not raw:
                raise HTTPException(status_code=400, detail="empty file")
            doc_id = document_id or str(uuid.uuid4())
            ragflow = get_ragflow()
            embedder = get_embedder()
            hybrid = get_hybrid()
            graph = get_graph()
            lightrag = get_lightrag()

            chunks = ragflow.parse_bytes(raw, doc_id, filename=file.filename or "")
            success = 0
            for chunk_text in chunks:
                vec = embedder.embed(chunk_text)
                hybrid.add(doc_id, chunk_text, vec, {"filename": file.filename or ""})
                graph.insert(chunk_text, doc_id, {"filename": file.filename or ""})
                lightrag.insert(chunk_text, doc_id, {"filename": file.filename or ""})
                success += 1
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
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/rag/ingest", response_model=IngestResponse)
    async def ingest_endpoint(req: IngestRequest) -> IngestResponse:
        try:
            return ingest(req)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/rag/search", response_model=RetrievalResponse)
    async def search(req: RetrievalRequest) -> RetrievalResponse:
        try:
            return retrieve(req)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.get("/api/v1/rag/stats", response_model=StatsResponse)
    async def stats() -> StatsResponse:
        return StatsResponse(
            total_chunks=get_hybrid().count(),
            embedder_dim=get_embedder().dim,
        )

    @app.get("/api/v1/rag/admin/pg-stats", response_model=PgStatsResponse)
    async def pg_stats() -> PgStatsResponse:
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
