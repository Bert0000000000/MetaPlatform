"""Ingest service: fan-out to Hybrid + Graph + LightRAG.

v3.0 Plan D: ingest writes to:
- Hybrid (Milvus + BM25)
- GraphRAG (Neo4j rag-graphrag, entity graph)
- LightRAG (Neo4j lrag-graph, thematic graph)
"""
from __future__ import annotations

from mate_tech_rag.api.retrieval import get_embedder, get_graph, get_hybrid, get_lightrag
from mate_tech_rag.api.schemas import IngestRequest, IngestResponse


def ingest(req: IngestRequest) -> IngestResponse:
    embedder = get_embedder()
    hybrid = get_hybrid()
    graph = get_graph()
    lightrag = get_lightrag()

    success = 0
    for chunk_text in req.chunks:
        vec = embedder.embed(chunk_text)
        hybrid.add(req.document_id, chunk_text, vec, req.metadata)
        graph.insert(chunk_text, req.document_id, req.metadata)
        lightrag.insert(chunk_text, req.document_id, req.metadata)
        success += 1
    return IngestResponse(
        document_id=req.document_id,
        chunk_count=success,
        total_chunks=len(req.chunks),
    )