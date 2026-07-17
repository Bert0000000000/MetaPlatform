"""Graph-enhanced search endpoint (P1-RAG-08)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_event_service, get_graph_enhanced_service
from app.models.schemas import GraphSearchRequest
from app.services.event_service import EventService
from app.services.graph_enhanced_service import GraphEnhancedService

router = APIRouter(tags=["graph-search"])


@router.post(
    "/graph-search",
    summary="图谱增强检索（结合知识图谱推理扩展检索范围）",
)
async def graph_search(
    body: GraphSearchRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: GraphEnhancedService = Depends(get_graph_enhanced_service),
    event_service: EventService = Depends(get_event_service),
) -> dict:
    """Graph-enhanced search that expands retrieval using ontology reasoning."""

    # Publish search event.
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="GRAPH_SEARCH_REQUESTED",
        payload={
            "query": body.query,
            "kbId": body.knowledgeBaseId,
            "depth": body.depth,
            "topK": body.topK,
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    result = await service.graph_search(
        tenant_id=ctx.tenant_id,
        query=body.query,
        kb_id=body.knowledgeBaseId,
        depth=body.depth,
        top_k=body.topK,
    )

    # Publish completion event.
    await event_service.publish_event(
        tenant_id=ctx.tenant_id,
        event_type="GRAPH_SEARCH_COMPLETED",
        payload={
            "resultCount": len(result.get("chunks", [])),
            "graphNodeCount": len(result.get("graphContext", {}).get("nodes", [])),
            "kbId": body.knowledgeBaseId,
            "traceId": ctx.trace_id,
        },
        headers={"traceId": ctx.trace_id, "X-Trace-Id": ctx.trace_id},
    )

    return success(result, trace_id=ctx.trace_id)
