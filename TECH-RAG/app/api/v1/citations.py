"""Citation endpoints (P1-RAG-10)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_citation_service, get_event_service
from app.models.schemas import CitationBatchRequest, CitationLocateRequest
from app.services.citation_service import CitationService
from app.services.event_service import EventService

router = APIRouter(tags=["citations"])


@router.post(
    "/citations/locate",
    summary="引用溯源定位（原文定位+高亮+置信度评分）",
)
async def locate_citations(
    body: CitationLocateRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CitationService = Depends(get_citation_service),
    event_service: EventService = Depends(get_event_service),
) -> dict:
    """Locate citations in source documents for a given query."""

    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="CITATION_LOCATE_REQUESTED",
        payload={
            "query": body.query,
            "chunkIdCount": len(body.chunkIds),
            "searchResultCount": len(body.searchResults),
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    citations = await service.locate_citations(
        tenant_id=ctx.tenant_id,
        query=body.query,
        chunk_ids=body.chunkIds if body.chunkIds else None,
        search_results=body.searchResults if body.searchResults else None,
    )

    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="CITATION_LOCATE_COMPLETED",
        payload={
            "citationCount": len(citations),
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    return success({"citations": citations}, trace_id=ctx.trace_id)


@router.get(
    "/citations/{chunk_id}",
    summary="获取单个 chunk 的引用详情",
)
async def get_citation(
    chunk_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CitationService = Depends(get_citation_service),
    query: str = Query(default="", description="Query string for span matching"),
) -> dict:
    """Get citation detail for a specific chunk."""

    citation = await service.get_citation(
        tenant_id=ctx.tenant_id,
        chunk_id=chunk_id,
        query=query,
    )
    return success(citation, trace_id=ctx.trace_id)


@router.post(
    "/citations/batch",
    summary="批量引用溯源定位",
)
async def batch_locate_citations(
    body: CitationBatchRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CitationService = Depends(get_citation_service),
    event_service: EventService = Depends(get_event_service),
) -> dict:
    """Batch locate citations for multiple chunks."""

    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="CITATION_BATCH_REQUESTED",
        payload={
            "query": body.query,
            "chunkIdCount": len(body.chunkIds),
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    citations = await service.batch_locate(
        tenant_id=ctx.tenant_id,
        query=body.query,
        chunk_ids=body.chunkIds,
    )

    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="CITATION_BATCH_COMPLETED",
        payload={
            "citationCount": len(citations),
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    return success({"citations": citations}, trace_id=ctx.trace_id)
