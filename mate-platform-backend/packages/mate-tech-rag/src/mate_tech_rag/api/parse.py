"""RAGFlow parse service: DeepDoc-style parsing + 3-index fan-out.

Pipeline:
1. RAGFlowClient.parse(content) -> list of cleaned chunks
2. For each chunk: embed + index into Hybrid + Graph + LightRAG
3. Return chunk count + fan-out list
"""
from __future__ import annotations

from mate_tech_rag.api.retrieval import (
    get_embedder,
    get_graph,
    get_hybrid,
    get_lightrag,
    get_ragflow,
)
from mate_tech_rag.api.schemas import ParseRequest, ParseResponse

INDEX_NAMES = ("hybrid", "graph", "lightrag")


def parse_document(req: ParseRequest) -> ParseResponse:
    ragflow = get_ragflow()
    embedder = get_embedder()
    hybrid = get_hybrid()
    graph = get_graph()
    lightrag = get_lightrag()

    chunks = ragflow.parse(req.content, req.document_id, metadata=req.metadata)
    success = 0
    for chunk_text in chunks:
        vec = embedder.embed(chunk_text)
        hybrid.add(req.document_id, chunk_text, vec, req.metadata)
        graph.insert(chunk_text, req.document_id, req.metadata)
        lightrag.insert(chunk_text, req.document_id, req.metadata)
        success += 1

    return ParseResponse(
        document_id=req.document_id,
        chunk_count=success,
        ragflow_parsed=len(chunks),
        indexed_in=list(INDEX_NAMES) if success else [],
    )
