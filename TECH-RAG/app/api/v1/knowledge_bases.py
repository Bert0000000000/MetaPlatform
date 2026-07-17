"""Knowledge base CRUD endpoints (P1-RAG-02) + search config (P1-RAG-06)."""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_kb_service
from app.models.schemas import (
    CreateKnowledgeBaseRequest,
    KnowledgeBaseStatus,
    SearchConfig,
    UpdateKnowledgeBaseRequest,
    UpdateSearchConfigRequest,
    to_kb_detail,
    to_kb_list_item,
)
from app.services.knowledge_base_service import KnowledgeBaseService

router = APIRouter(tags=["knowledge-bases"])


def _parse_status(value: Optional[str]) -> Optional[KnowledgeBaseStatus]:
    if value is None:
        return None
    try:
        return KnowledgeBaseStatus(value.upper())
    except ValueError:
        return None


@router.post("/knowledge-bases", summary="创建知识库")
async def create_knowledge_base(
    body: CreateKnowledgeBaseRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    kb = await service.create(ctx.tenant_id, body)
    return success(to_kb_detail(kb), trace_id=ctx.trace_id)


@router.get("/knowledge-bases", summary="知识库列表(分页)")
async def list_knowledge_bases(
    request: Request,
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    ss = _parse_status(status)
    items, total = await service.list(
        ctx.tenant_id,
        status=ss,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [to_kb_list_item(i) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/knowledge-bases/{kb_id}", summary="知识库详情")
async def get_knowledge_base(
    kb_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    kb = await service.get(ctx.tenant_id, kb_id)
    return success(to_kb_detail(kb), trace_id=ctx.trace_id)


@router.put("/knowledge-bases/{kb_id}", summary="更新知识库")
async def update_knowledge_base(
    kb_id: str,
    body: UpdateKnowledgeBaseRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    kb = await service.update(ctx.tenant_id, kb_id, body)
    return success(to_kb_detail(kb), trace_id=ctx.trace_id)


@router.delete("/knowledge-bases/{kb_id}", summary="删除知识库")
async def delete_knowledge_base(
    kb_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    result = await service.delete(ctx.tenant_id, kb_id)
    return success(result, trace_id=ctx.trace_id)


# ----------------------------------------------- retrieval config (P1-RAG-06)


@router.get(
    "/knowledge-bases/{kb_id}/retrieval-config",
    summary="获取知识库检索配置",
)
async def get_retrieval_config(
    kb_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    config = await service.get_search_config(ctx.tenant_id, kb_id)
    return success(config.model_dump(), trace_id=ctx.trace_id)


@router.put(
    "/knowledge-bases/{kb_id}/retrieval-config",
    summary="更新知识库检索配置",
)
async def update_retrieval_config(
    kb_id: str,
    body: UpdateSearchConfigRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: KnowledgeBaseService = Depends(get_kb_service),
) -> dict:
    config = await service.update_search_config(ctx.tenant_id, kb_id, body)
    return success(config.model_dump(), trace_id=ctx.trace_id)
