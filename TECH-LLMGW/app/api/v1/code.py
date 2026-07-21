"""Code generation / execution / template / snippet / share endpoints (V12-02).

All paths are mounted under ``/api/v1/llmgw`` (the router prefix).  The
endpoint surface covers REQ-038 ~ REQ-045 of APP-SUPERAI.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request

from app.code.schemas import (
    CodeExecuteRequest,
    CodeGenerateRequest,
    CodeShareRequest,
    CodeSnippetCreateRequest,
    CodeSnippetDiffRequest,
    CodeSnippetUpdateRequest,
    CodeTemplateCreateRequest,
    CodeTemplateUpdateRequest,
)
from app.code.service import CodeService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_code_service

router = APIRouter(tags=["code"])


# --------------------------------------------------------------- REQ-038


@router.post("/code/generate", summary="自然语言转代码")
async def generate_code(
    request: Request,
    body: CodeGenerateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    result = await service.generate(
        ctx.tenant_id,
        body.description,
        body.language,
        context=body.context,
        model_id=body.modelId,
    )
    return success(service.gen_result_to_dict(result), trace_id=ctx.trace_id)


# --------------------------------------------------- REQ-041 / REQ-042


@router.post("/code/execute", summary="沙箱执行代码")
async def execute_code(
    request: Request,
    body: CodeExecuteRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    result = service.execute(body)
    return success(service.execution_to_dict(result), trace_id=ctx.trace_id)


# --------------------------------------------------------------- REQ-043


@router.post("/code/templates", summary="创建代码模板")
async def create_template(
    request: Request,
    body: CodeTemplateCreateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.create_template(
        ctx.tenant_id,
        body,
        created_by=ctx.user_id or "system",
    )
    return success(service.template_to_dict(record), trace_id=ctx.trace_id)


@router.get("/code/templates", summary="代码模板列表")
async def list_templates(
    request: Request,
    language: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    items = service.list_templates(
        ctx.tenant_id,
        language=language,
        category=category,
        keyword=keyword,
    )
    return success(
        {
            "items": [service.template_to_dict(t) for t in items],
            "total": len(items),
        },
        trace_id=ctx.trace_id,
    )


@router.get("/code/templates/{template_id}", summary="代码模板详情")
async def get_template(
    template_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.get_template(ctx.tenant_id, template_id)
    return success(service.template_to_dict(record), trace_id=ctx.trace_id)


@router.put("/code/templates/{template_id}", summary="更新代码模板")
async def update_template(
    template_id: str,
    request: Request,
    body: CodeTemplateUpdateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.update_template(ctx.tenant_id, template_id, body)
    return success(service.template_to_dict(record), trace_id=ctx.trace_id)


@router.delete("/code/templates/{template_id}", summary="删除代码模板")
async def delete_template(
    template_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    result = service.delete_template(ctx.tenant_id, template_id)
    return success(result, trace_id=ctx.trace_id)


# ----------------------------------------------- REQ-040 / REQ-044 snippets


@router.post("/code/snippets", summary="保存代码片段")
async def create_snippet(
    request: Request,
    body: CodeSnippetCreateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.create_snippet(
        ctx.tenant_id,
        body,
        created_by=ctx.user_id or "system",
    )
    return success(service.snippet_to_dict(record), trace_id=ctx.trace_id)


@router.get("/code/snippets", summary="代码片段列表")
async def list_snippets(
    request: Request,
    language: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    items = service.list_snippets(
        ctx.tenant_id,
        language=language,
        keyword=keyword,
    )
    return success(
        {
            "items": [service.snippet_to_dict(s) for s in items],
            "total": len(items),
        },
        trace_id=ctx.trace_id,
    )


@router.get("/code/snippets/{snippet_id}", summary="代码片段详情")
async def get_snippet(
    snippet_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.get_snippet(ctx.tenant_id, snippet_id)
    return success(service.snippet_to_dict(record), trace_id=ctx.trace_id)


@router.put("/code/snippets/{snippet_id}", summary="更新代码片段（创建新版本）")
async def update_snippet(
    snippet_id: str,
    request: Request,
    body: CodeSnippetUpdateRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.update_snippet(
        ctx.tenant_id,
        snippet_id,
        body,
        updated_by=ctx.user_id or "system",
    )
    return success(service.snippet_to_dict(record), trace_id=ctx.trace_id)


@router.delete("/code/snippets/{snippet_id}", summary="删除代码片段")
async def delete_snippet(
    snippet_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    result = service.delete_snippet(ctx.tenant_id, snippet_id)
    return success(result, trace_id=ctx.trace_id)


@router.get("/code/snippets/{snippet_id}/versions", summary="代码片段版本历史")
async def list_snippet_versions(
    snippet_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    versions = service.list_snippet_versions(ctx.tenant_id, snippet_id)
    return success(
        {
            "items": [service.version_to_dict(v) for v in versions],
            "total": len(versions),
        },
        trace_id=ctx.trace_id,
    )


@router.get("/code/snippets/{snippet_id}/versions/{version}", summary="获取代码片段指定版本")
async def get_snippet_version(
    snippet_id: str,
    version: int,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.get_snippet_version(ctx.tenant_id, snippet_id, version)
    return success(service.version_to_dict(record), trace_id=ctx.trace_id)


@router.post("/code/snippets/{snippet_id}/diff", summary="比较代码片段版本差异")
async def diff_snippet_versions(
    snippet_id: str,
    request: Request,
    body: CodeSnippetDiffRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    result = service.diff_snippet_versions(
        ctx.tenant_id,
        snippet_id,
        body.versionA,
        body.versionB,
    )
    return success(result.model_dump(), trace_id=ctx.trace_id)


# --------------------------------------------------------------- REQ-045


@router.post("/code/share", summary="生成代码分享链接")
async def create_share(
    request: Request,
    body: CodeShareRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.create_share(
        ctx.tenant_id,
        body,
        created_by=ctx.user_id or "system",
    )
    return success(service.share_to_dict(record), trace_id=ctx.trace_id)


@router.get("/code/share", summary="分享列表")
async def list_shares(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    items = service.list_shares(ctx.tenant_id)
    return success(
        {
            "items": [service.share_to_dict(s) for s in items],
            "total": len(items),
        },
        trace_id=ctx.trace_id,
    )


@router.get("/code/share/{share_id}", summary="获取分享内容（公开）")
async def get_share(
    share_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    record = service.get_share(share_id)
    return success(service.share_to_dict(record), trace_id=ctx.trace_id)


@router.delete("/code/share/{share_id}", summary="撤销代码分享")
async def delete_share(
    share_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CodeService = Depends(get_code_service),
) -> dict:
    result = service.delete_share(ctx.tenant_id, share_id)
    return success(result, trace_id=ctx.trace_id)
