"""Deliverable endpoints (P3-DASH-08, 09)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deliverables.schemas import (
    DeliverableDownloadRequest,
    DeliverableFormat,
    DeliverableStatus,
    DeliverableType,
)
from app.deliverables.service import DeliverableService
from app.deps import get_deliverable_service

router = APIRouter(tags=["deliverables"])


def _parse_type(value: Optional[str]) -> Optional[DeliverableType]:
    if value is None:
        return None
    try:
        return DeliverableType(value.lower())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的交付物类型: {value}",
            data={"allowed": [t.value for t in DeliverableType]},
        ) from exc


def _parse_format(value: str) -> DeliverableFormat:
    try:
        return DeliverableFormat(value.lower())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的下载格式: {value}",
            data={"allowed": [f.value for f in DeliverableFormat]},
        ) from exc


def _parse_status(value: Optional[str]) -> DeliverableStatus:
    if value is None:
        return DeliverableStatus.READY
    try:
        return DeliverableStatus(value.lower())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的交付物状态: {value}",
            data={"allowed": [s.value for s in DeliverableStatus]},
        ) from exc


@router.get("/deliverables", summary="交付物列表(分页)")
async def list_deliverables(
    request: Request,
    keyword: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: DeliverableService = Depends(get_deliverable_service),
) -> dict:
    t = _parse_type(type)
    items, total = await service.list(
        ctx.tenant_id,
        keyword=keyword,
        type=t,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [i.model_dump(by_alias=True) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.post("/deliverables", summary="创建交付物")
async def create_deliverable(
    request: Request,
    body: dict,
    ctx: RequestContext = Depends(request_context_dep),
    service: DeliverableService = Depends(get_deliverable_service),
) -> dict:
    type_value = _parse_type(body.get("type", "report"))
    if type_value is None:
        raise InvalidParamError("type 不能为空", data={"field": "type"})
    item = await service.create(
        ctx.tenant_id,
        type=type_value,
        title=body.get("title", ""),
        source=body.get("source", ""),
        description=body.get("description"),
        format=_parse_format(body.get("format", "pdf")),
        status=_parse_status(body.get("status", "ready")),
        size=body.get("size", 0),
        created_by=body.get("createdBy", ctx.user_id or "system"),
        download_url=body.get("downloadUrl"),
    )
    return success(item.model_dump(by_alias=True), trace_id=ctx.trace_id)


@router.get("/deliverables/{deliverable_id}", summary="交付物详情")
async def get_deliverable(
    deliverable_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DeliverableService = Depends(get_deliverable_service),
) -> dict:
    item = await service.get(ctx.tenant_id, deliverable_id)
    return success(item.model_dump(by_alias=True), trace_id=ctx.trace_id)


@router.post("/deliverables/{deliverable_id}/download", summary="生成下载链接")
async def download_deliverable(
    deliverable_id: str,
    request: Request,
    body: DeliverableDownloadRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: DeliverableService = Depends(get_deliverable_service),
) -> dict:
    result = await service.download(ctx.tenant_id, deliverable_id, body.format)
    return success(result.model_dump(by_alias=True), trace_id=ctx.trace_id)


@router.delete("/deliverables/{deliverable_id}", summary="删除交付物")
async def delete_deliverable(
    deliverable_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DeliverableService = Depends(get_deliverable_service),
) -> dict:
    ok = await service.delete(ctx.tenant_id, deliverable_id)
    return success({"deleted": ok, "id": deliverable_id}, trace_id=ctx.trace_id)
