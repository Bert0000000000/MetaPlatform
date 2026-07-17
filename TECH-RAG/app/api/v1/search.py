"""Search endpoints: vector, keyword (BM25), and hybrid (RRF) (P1-RAG-04/05/06/07)."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import (
    get_event_service,
    get_hybrid_search_service,
    get_keyword_search_service,
    get_kb_service,
    get_retrieval_service,
    get_rerank_service,
)
from app.models.schemas import (
    HybridSearchRequest,
    KeywordSearchRequest,
    SearchConfig,
    SearchRequest,
)
from app.services.event_service import EventService
from app.services.hybrid_search_service import HybridSearchService
from app.services.keyword_search_service import KeywordSearchService
from app.services.knowledge_base_service import KnowledgeBaseService
from app.services.rerank_service import RerankService
from app.services.retrieval_service import RetrievalService

logger = logging.getLogger("techrag")

router = APIRouter(tags=["search"])


async def _get_kb_search_config(
    kb_service: KnowledgeBaseService, tenant_id: str, kb_id: str
) -> SearchConfig:
    """Load search config for a KB, returning defaults if not set."""
    try:
        kb = await kb_service._kb_repo.get(kb_id, tenant_id)
        if kb and kb.search_config:
            data = json.loads(kb.search_config)
            return SearchConfig(**data)
    except Exception:
        logger.debug("Failed to load KB search_config, using defaults", exc_info=True)
    return SearchConfig()


@router.post(
    "/knowledge-bases/{kb_id}/search",
    summary="知识库向量检索",
)
async def search(
    kb_id: str,
    body: SearchRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: RetrievalService = Depends(get_retrieval_service),
    event_service: EventService = Depends(get_event_service),
) -> dict:
    # Publish RETRIEVAL_REQUESTED event (P1-RAG-07).
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="RETRIEVAL_REQUESTED",
        payload={
            "query": body.query,
            "kbId": kb_id,
            "topK": body.topK,
            "mode": "vector",
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    results = await service.search(
        query_text=body.query,
        kb_id=kb_id,
        tenant_id=ctx.tenant_id,
        top_k=body.topK,
    )

    # Publish RETRIEVAL_COMPLETED event (P1-RAG-07).
    top_score = results[0]["score"] if results else 0.0
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="RETRIEVAL_COMPLETED",
        payload={
            "resultCount": len(results),
            "topScore": top_score,
            "kbId": kb_id,
            "mode": "vector",
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    return success({"results": results}, trace_id=ctx.trace_id)


@router.post(
    "/knowledge-bases/{kb_id}/search/keyword",
    summary="知识库关键词检索（BM25）",
)
async def keyword_search(
    kb_id: str,
    body: KeywordSearchRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: KeywordSearchService = Depends(get_keyword_search_service),
    event_service: EventService = Depends(get_event_service),
) -> dict:
    # Publish RETRIEVAL_REQUESTED event.
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="RETRIEVAL_REQUESTED",
        payload={
            "query": body.query,
            "kbId": kb_id,
            "topK": body.topK,
            "mode": "keyword",
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    results = await service.search(
        query=body.query,
        kb_id=kb_id,
        tenant_id=ctx.tenant_id,
        top_k=body.topK,
    )

    # Publish RETRIEVAL_COMPLETED event.
    top_score = results[0]["score"] if results else 0.0
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="RETRIEVAL_COMPLETED",
        payload={
            "resultCount": len(results),
            "topScore": top_score,
            "kbId": kb_id,
            "mode": "keyword",
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    return success({"results": results}, trace_id=ctx.trace_id)


@router.post(
    "/knowledge-bases/{kb_id}/search/hybrid",
    summary="知识库混合检索（向量+BM25 RRF融合）",
)
async def hybrid_search(
    kb_id: str,
    body: HybridSearchRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    hybrid_service: HybridSearchService = Depends(get_hybrid_search_service),
    rerank_service: RerankService = Depends(get_rerank_service),
    kb_service: KnowledgeBaseService = Depends(get_kb_service),
    event_service: EventService = Depends(get_event_service),
) -> dict:
    # Load KB-level default config (P1-RAG-06).
    kb_config = await _get_kb_search_config(kb_service, ctx.tenant_id, kb_id)

    # Resolve effective parameters: request overrides KB config.
    top_k = body.topK
    vector_weight = body.vectorWeight
    similarity_threshold = (
        body.similarityThreshold
        if body.similarityThreshold is not None
        else kb_config.similarityThreshold
    )
    rerank_enabled = (
        body.rerankEnabled
        if body.rerankEnabled is not None
        else kb_config.rerankEnabled
    )

    # Publish RETRIEVAL_REQUESTED event.
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="RETRIEVAL_REQUESTED",
        payload={
            "query": body.query,
            "kbId": kb_id,
            "topK": top_k,
            "vectorWeight": vector_weight,
            "rerankEnabled": rerank_enabled,
            "mode": "hybrid",
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    # Perform hybrid search with RRF fusion.
    results = await hybrid_service.hybrid_search(
        query=body.query,
        kb_id=kb_id,
        tenant_id=ctx.tenant_id,
        top_k=top_k,
        vector_weight=vector_weight,
    )

    # Apply similarity threshold filter (P1-RAG-06).
    if similarity_threshold > 0:
        results = [r for r in results if r["score"] >= similarity_threshold]

    # Apply rerank if enabled (P1-RAG-06).
    if rerank_enabled and results:
        results = await rerank_service.rerank(
            query=body.query,
            documents=results,
            top_k=len(results),
        )

    # Publish RETRIEVAL_COMPLETED event.
    top_score = results[0]["score"] if results else 0.0
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="RETRIEVAL_COMPLETED",
        payload={
            "resultCount": len(results),
            "topScore": top_score,
            "kbId": kb_id,
            "mode": "hybrid",
            "rerankEnabled": rerank_enabled,
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    return success({"results": results}, trace_id=ctx.trace_id)
