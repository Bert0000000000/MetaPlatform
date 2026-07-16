"""Model management endpoints (P1-LLMGW-01)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_model_service
from app.models.schemas import ModelType
from app.models.service import ModelService

router = APIRouter(tags=["models"])


class SyncModelsBody(BaseModel):
    providers: Optional[list[str]] = Field(default=None)


def _coerce_type(type_: Optional[str]) -> Optional[ModelType]:
    if type_ is None:
        return None
    upper = type_.upper()
    try:
        return ModelType(upper)
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的模型类型: {type_}",
            data={"allowed": [t.value for t in ModelType]},
        ) from exc


@router.post("/models/sync", summary="同步供应商模型列表")
async def sync_models(
    request: Request,
    body: Optional[SyncModelsBody] = None,
    ctx: RequestContext = Depends(request_context_dep),
    service: ModelService = Depends(get_model_service),
) -> dict:
    providers = body.providers if body else None
    result = service.sync(ctx.tenant_id, providers=providers)
    payload_out = {
        "syncedAt": result["syncedAt"].isoformat(),
        "providers": result["providers"],
        "total": result["total"],
    }
    return success(payload_out, trace_id=ctx.trace_id)


@router.get("/models", summary="列出已同步模型")
async def list_models(
    request: Request,
    provider: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    enabled: Optional[bool] = Query(default=True),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: ModelService = Depends(get_model_service),
) -> dict:
    type_ = _coerce_type(type)
    models = service.list(
        ctx.tenant_id,
        provider=provider,
        type_=type_,
        enabled=enabled,
    )
    items = service.to_list_items(models)
    paged = build_page(items, total=len(items), page=page, page_size=pageSize)
    return success(paged, trace_id=ctx.trace_id)


@router.get("/models/multimodal", summary="多模态模型列表")
async def list_multimodal_models(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ModelService = Depends(get_model_service),
) -> dict:
    models = service.list_multimodal(ctx.tenant_id)
    items = service.to_list_items(models)
    return success(
        {"items": items, "total": len(items)},
        trace_id=ctx.trace_id,
    )


@router.get("/models/embedding", summary="Embedding 模型列表")
async def list_embedding_models(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ModelService = Depends(get_model_service),
) -> dict:
    models = service.list_embedding(ctx.tenant_id)
    items = service.to_list_items(models)
    return success(
        {"items": items, "total": len(items)},
        trace_id=ctx.trace_id,
    )


@router.get("/models/global", summary="跨租户聚合模型列表")
async def list_global_models(
    request: Request,
    type: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: ModelService = Depends(get_model_service),
) -> dict:
    type_ = _coerce_type(type)
    models = service.list_global(ctx.tenant_id, type_=type_)
    items = service.to_list_items(models)
    return success(
        {"items": items, "total": len(items)},
        trace_id=ctx.trace_id,
    )


@router.get("/models/{model_id}", summary="模型详情")
async def get_model(
    model_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: ModelService = Depends(get_model_service),
) -> dict:
    model = service.detail(ctx.tenant_id, model_id)
    return success(service.to_detail(model), trace_id=ctx.trace_id)