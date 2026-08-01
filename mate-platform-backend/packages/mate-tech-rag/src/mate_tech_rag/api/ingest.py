"""Ingest service: tenant-scoped fan-out to Hybrid + Graph + LightRAG.

BUSINESS-SLICES deep implementation: adds tenant-scoped document
registration (INGESTING -> INDEXED | FAILED lifecycle), chunk content
validation (non-empty, whitespace-only rejection), and duplicate-chunk
deduplication within a single ingest request.

v3.0 Plan D: ingest writes to:
- Hybrid (Milvus + BM25)
- GraphRAG (Neo4j rag-graphrag, entity graph)
- LightRAG (Neo4j lrag-graph, thematic graph)
"""
from __future__ import annotations

from mate_tech_rag.api.document_registry import mark_failed, mark_indexed, register_document
from mate_tech_rag.api.retrieval import get_embedder, get_graph, get_hybrid, get_lightrag
from mate_tech_rag.api.schemas import IngestRequest, IngestResponse


def _validate_chunks(chunks: list[str]) -> list[str]:
    """Filter out empty / whitespace-only chunks and deduplicate.

    Returns the cleaned chunk list. Raises ValueError if ALL chunks are
    empty after cleaning (the caller maps this to HTTP 400).
    """
    seen: set[str] = set()
    cleaned: list[str] = []
    for chunk in chunks:
        text = chunk.strip() if isinstance(chunk, str) else ""
        if not text:
            continue
        if text in seen:
            continue
        seen.add(text)
        cleaned.append(text)
    if not cleaned:
        raise ValueError("all chunks are empty or whitespace-only")
    return cleaned


def ingest(req: IngestRequest, tenant_id: str = "") -> IngestResponse:
    """Ingest chunks into all 3 indexes with tenant-scoped lifecycle tracking.

    Args:
        req: the ingest request (document_id, chunks, metadata).
        tenant_id: the owning tenant; when non-empty the document is
            registered in the tenant-scoped registry so search can
            filter hits by ownership.
    """
    embedder = get_embedder()
    hybrid = get_hybrid()
    graph = get_graph()
    lightrag = get_lightrag()

    # Register the document in INGESTING state (if tenant-scoped).
    if tenant_id:
        register_document(tenant_id, req.document_id, source="ingest")

    try:
        cleaned = _validate_chunks(req.chunks)
    except ValueError as exc:
        if tenant_id:
            mark_failed(tenant_id, req.document_id, str(exc))
        raise

    success = 0
    try:
        for chunk_text in cleaned:
            vec = embedder.embed(chunk_text)
            hybrid.add(req.document_id, chunk_text, vec, req.metadata)
            graph.insert(chunk_text, req.document_id, req.metadata)
            lightrag.insert(chunk_text, req.document_id, req.metadata)
            success += 1
    except Exception as exc:
        if tenant_id:
            mark_failed(tenant_id, req.document_id, str(exc))
        raise

    if tenant_id:
        mark_indexed(tenant_id, req.document_id, success)

    return IngestResponse(
        document_id=req.document_id,
        chunk_count=success,
        total_chunks=len(req.chunks),
    )
