"""RAGFlow parse service: DeepDoc-style parsing + 3-index fan-out.

Pipeline:
1. RAGFlowClient.parse(content) -> list of cleaned chunks
2. For each chunk: embed + index into Hybrid + Graph + LightRAG
3. Return chunk count + fan-out list

P0 — per-request ragflow override:
    ``ParseRequest`` accepts ``base_url`` / ``api_key`` for tenant-scoped
    parsing. When set, ``parse_document`` wraps the ragflow call in the
    client's ``override()`` context manager so the singleton is rebound
    to the caller-supplied endpoint / key, then restored on exit.
"""
from __future__ import annotations

from contextlib import contextmanager, nullcontext

from mate_tech_rag.api.retrieval import (
    get_embedder,
    get_graph,
    get_hybrid,
    get_lightrag,
    get_pg_store,
    get_ragflow,
)
from mate_tech_rag.api.schemas import ParseRequest, ParseResponse

INDEX_NAMES = ("hybrid", "graph", "lightrag")


def _ragflow_override_cm(req: ParseRequest):
    """Return a context manager that applies req.base_url/api_key to the
    ragflow singleton for the duration of the block, or a no-op if the
    ragflow client doesn't support ``override()`` (e.g. InMemoryRAGFlowClient)
    or the request doesn't carry an override.
    """
    if not (req.base_url or req.api_key):
        return nullcontext()
    ragflow = get_ragflow()
    override = getattr(ragflow, "override", None)
    if override is None:
        return nullcontext()
    return override(base_url=req.base_url, api_key=req.api_key)


def parse_document(req: ParseRequest) -> ParseResponse:
    ragflow = get_ragflow()
    embedder = get_embedder()
    hybrid = get_hybrid()
    graph = get_graph()
    lightrag = get_lightrag()

    with _ragflow_override_cm(req):
        chunks = ragflow.parse(req.content, req.document_id, metadata=req.metadata)
        pg_store = get_pg_store()
        success = 0
        for chunk_text in chunks:
            vec = embedder.embed(chunk_text)
            chunk_id = hybrid.add(req.document_id, chunk_text, vec, req.metadata)
            graph.insert(chunk_text, req.document_id, req.metadata)
            lightrag.insert(chunk_text, req.document_id, req.metadata)
            # Write to PG for BM25 search (idempotent upsert by chunk_id).
            if pg_store is not None:
                try:
                    pg_store.save_chunk(chunk_id, req.document_id, chunk_text, req.metadata)
                except Exception:
                    pass
            success += 1

    return ParseResponse(
        document_id=req.document_id,
        chunk_count=success,
        ragflow_parsed=len(chunks),
        indexed_in=list(INDEX_NAMES) if success else [],
    )
