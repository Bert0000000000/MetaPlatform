"""Prompt template management endpoints (P1-LLMGW-03)."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.prompts.schemas import (
    PromptCreateRequest,
    PromptPreviewRequest,
    PromptRenderRequest,
    PromptRollbackRequest,
    PromptUpdateRequest,
)
from app.prompts.service import PromptService
from app.deps import get_prompt_service

router = APIRouter(tags=["prompts"])


def _split_tags(tags: Optional[str]) -> Optional[List[str]]:
    if tags is None:
        return None
    parts = [t.strip() for t in tags.split(",") if t.strip()]
    return parts if parts else None


@router.post("/prompts", summary="创建 Prompt 模板")
async def create_prompt(
    request: Request,
    body: PromptCreateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    record = service.create(
        ctx.tenant_id,
        body,
        created_by=ctx.user_id or "system",
    )
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.get("/prompts", summary="Prompt 模板列表")
async def list_prompts(
    request: Request,
    keyword: Optional[str] = Query(default=None),
    tags: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    result = service.list(
        ctx.tenant_id,
        keyword=keyword,
        tags=_split_tags(tags),
        category=category,
        status=status,
        page=page,
        page_size=pageSize,
    )
    return success(result, trace_id=ctx.trace_id)


@router.get("/prompts/{prompt_id}", summary="Prompt 模板详情")
async def get_prompt(
    prompt_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    record = service.detail(ctx.tenant_id, prompt_id)
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.put("/prompts/{prompt_id}", summary="更新 Prompt 模板")
async def update_prompt(
    prompt_id: str,
    request: Request,
    body: PromptUpdateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    record = service.update(
        ctx.tenant_id,
        prompt_id,
        body,
        updated_by=ctx.user_id or "system",
    )
    return success(
        {
            "promptId": record.prompt_id,
            "promptKey": record.prompt_key,
            "name": record.name,
            "version": record.version,
            "previousVersion": record.version - 1,
            "changeLog": record.change_log,
            "updatedAt": record.updated_at,
        },
        trace_id=ctx.trace_id,
    )


@router.delete("/prompts/{prompt_id}", summary="删除 Prompt 模板")
async def delete_prompt(
    prompt_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    result = service.delete(ctx.tenant_id, prompt_id)
    return success(result, trace_id=ctx.trace_id)


@router.get("/prompts/{prompt_id}/versions", summary="获取版本历史")
async def list_prompt_versions(
    prompt_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    versions = service.list_versions(ctx.tenant_id, prompt_id)
    return success(
        {
            "items": [service.to_version_item(v) for v in versions],
            "total": len(versions),
        },
        trace_id=ctx.trace_id,
    )


@router.get("/prompts/{prompt_id}/versions/{version}", summary="获取指定版本")
async def get_prompt_version(
    prompt_id: str,
    version: int,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    record = service.get_version(ctx.tenant_id, prompt_id, version)
    return success(service.to_detail(record), trace_id=ctx.trace_id)


@router.post("/prompts/{prompt_id}/rollback", summary="回滚到指定版本")
async def rollback_prompt(
    prompt_id: str,
    request: Request,
    body: PromptRollbackRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    record = service.rollback(
        ctx.tenant_id,
        prompt_id,
        body,
        updated_by=ctx.user_id or "system",
    )
    return success(
        {
            "promptId": record.prompt_id,
            "promptKey": record.prompt_key,
            "version": record.version,
            "rolledBackFrom": record.version - 1,
            "rolledBackTo": body.targetVersion,
            "changeLog": record.change_log,
            "updatedAt": record.updated_at,
        },
        trace_id=ctx.trace_id,
    )


@router.post("/prompts/{prompt_id}/render", summary="渲染 Prompt")
async def render_prompt(
    prompt_id: str,
    request: Request,
    body: PromptRenderRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    result = service.render(ctx.tenant_id, prompt_id, body)
    return success(result, trace_id=ctx.trace_id)


@router.post("/prompts/{prompt_id}/preview", summary="预览 Prompt")
async def preview_prompt(
    prompt_id: str,
    request: Request,
    body: PromptPreviewRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: PromptService = Depends(get_prompt_service),
) -> dict:
    result = await service.preview(
        ctx.tenant_id,
        prompt_id,
        body,
        user_id=ctx.user_id,
    )
    return success(result, trace_id=ctx.trace_id)
