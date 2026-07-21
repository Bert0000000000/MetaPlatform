"""Lineage endpoints (V11-02)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_lineage_service
from app.lineage.schemas import ImpactAnalysisRequest
from app.lineage.service import LineageService

router = APIRouter(tags=["lineage"])


@router.get("/lineage", summary="获取血缘图（按 scope 过滤）")
async def get_lineage(
    request: Request,
    scope: str = Query(default="all"),
    ctx: RequestContext = Depends(request_context_dep),
    service: LineageService = Depends(get_lineage_service),
) -> dict:
    data = service.get_lineage(scope)
    return success(data.model_dump(mode="json"), trace_id=ctx.trace_id)


@router.get("/lineage/{node_id}", summary="获取以指定节点为根的子树血缘")
async def get_lineage_by_node(
    node_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LineageService = Depends(get_lineage_service),
) -> dict:
    data = service.get_lineage_by_node(node_id)
    return success(data.model_dump(mode="json"), trace_id=ctx.trace_id)


@router.post("/lineage/impact", summary="影响分析")
async def analyze_impact(
    body: ImpactAnalysisRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: LineageService = Depends(get_lineage_service),
) -> dict:
    data = service.analyze_impact(body.nodeId)
    return success(data.model_dump(mode="json"), trace_id=ctx.trace_id)
