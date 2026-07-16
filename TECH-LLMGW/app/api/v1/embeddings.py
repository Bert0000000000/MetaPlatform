"""Batch embedding endpoints (P1-LLMGW-03)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_embedding_service
from app.embeddings.schemas import BatchEmbeddingRequest
from app.embeddings.service import EmbeddingService

router = APIRouter(tags=["embeddings"])


@router.post("/embeddings/batch", summary="批量向量化")
async def batch_embeddings(
    request: Request,
    body: BatchEmbeddingRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: EmbeddingService = Depends(get_embedding_service),
) -> dict:
    resp = service.batch(ctx.tenant_id, body)
    return success(
        {
            "model": resp.model,
            "provider": resp.provider,
            "dimension": resp.dimension,
            "embeddings": resp.embeddings,
            "usage": resp.usage.model_dump(),
        },
        trace_id=ctx.trace_id,
    )