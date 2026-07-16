"""Vector search endpoints (P1-RAG-04)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_retrieval_service
from app.models.schemas import SearchRequest
from app.services.retrieval_service import RetrievalService

router = APIRouter(tags=["search"])


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
) -> dict:
    results = await service.search(
        query_text=body.query,
        kb_id=kb_id,
        tenant_id=ctx.tenant_id,
        top_k=body.topK,
    )
    return success({"results": results}, trace_id=ctx.trace_id)
