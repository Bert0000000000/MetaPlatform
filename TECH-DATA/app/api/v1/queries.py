"""SQL query execution endpoints (V13-12)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_query_service
from app.services.query_service import QueryService

router = APIRouter(tags=["queries"])


@router.post("/queries/execute", summary="执行 SQL")
async def execute_query(
    body: dict,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QueryService = Depends(get_query_service),
) -> dict:
    result = await service.execute(
        ctx.tenant_id,
        body.get("dataSourceId", ""),
        body.get("sql", ""),
    )
    return success(result.model_dump(by_alias=True), trace_id=ctx.trace_id)


@router.get("/queries/{query_id}/execution-plan", summary="执行计划")
async def get_execution_plan(
    query_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: QueryService = Depends(get_query_service),
) -> dict:
    plan = await service.execution_plan(ctx.tenant_id, query_id)
    return success({"plan": plan}, trace_id=ctx.trace_id)


@router.post("/queries/{query_id}/export", summary="导出结果")
async def export_query_result(
    query_id: str,
    request: Request,
    format: str = Query(default="csv", description="csv | json | excel"),
    ctx: RequestContext = Depends(request_context_dep),
    service: QueryService = Depends(get_query_service),
) -> StreamingResponse:
    content, media_type, filename = await service.export(
        ctx.tenant_id, query_id, format
    )
    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/queries/history", summary="分析历史")
async def list_query_history(
    request: Request,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: QueryService = Depends(get_query_service),
) -> dict:
    items, total = await service.history(
        ctx.tenant_id, page=page, page_size=pageSize
    )
    paged = build_page(
        [i.model_dump(by_alias=True) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)
