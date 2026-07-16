"""Data source CRUD endpoints (S-DATA-02)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.common.api_response import build_page, success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_datasource_service
from app.models.schemas import (
    CreateDataSourceRequest,
    DataSourceStatus,
    DataSourceType,
    UpdateDataSourceRequest,
    to_detail,
    to_list_item,
)
from app.services.datasource_service import DataSourceService

router = APIRouter(tags=["datasources"])


def _parse_source_type(value: Optional[str]) -> Optional[DataSourceType]:
    if value is None:
        return None
    try:
        return DataSourceType(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的数据源类型: {value}",
            data={"allowed": [t.value for t in DataSourceType]},
        ) from exc


def _parse_status(value: Optional[str]) -> Optional[DataSourceStatus]:
    if value is None:
        return None
    try:
        return DataSourceStatus(value.upper())
    except ValueError as exc:
        raise InvalidParamError(
            f"不支持的状态: {value}",
            data={"allowed": [s.value for s in DataSourceStatus]},
        ) from exc


@router.post("/datasources", summary="创建数据源")
async def create_datasource(
    body: CreateDataSourceRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DataSourceService = Depends(get_datasource_service),
) -> dict:
    ds = await service.create(ctx.tenant_id, body)
    return success(to_detail(ds), trace_id=ctx.trace_id)


@router.get("/datasources", summary="数据源列表(分页)")
async def list_datasources(
    request: Request,
    source_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: DataSourceService = Depends(get_datasource_service),
) -> dict:
    st = _parse_source_type(source_type)
    ss = _parse_status(status)
    items, total = await service.list(
        ctx.tenant_id,
        source_type=st,
        status=ss,
        page=page,
        page_size=pageSize,
    )
    paged = build_page(
        [to_list_item(i) for i in items],
        total=total,
        page=page,
        page_size=pageSize,
    )
    return success(paged, trace_id=ctx.trace_id)


@router.get("/datasources/{ds_id}", summary="数据源详情")
async def get_datasource(
    ds_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DataSourceService = Depends(get_datasource_service),
) -> dict:
    ds = await service.get(ctx.tenant_id, ds_id)
    return success(to_detail(ds), trace_id=ctx.trace_id)


@router.put("/datasources/{ds_id}", summary="更新数据源")
async def update_datasource(
    ds_id: str,
    body: UpdateDataSourceRequest,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DataSourceService = Depends(get_datasource_service),
) -> dict:
    ds = await service.update(ctx.tenant_id, ds_id, body)
    return success(to_detail(ds), trace_id=ctx.trace_id)


@router.delete("/datasources/{ds_id}", summary="删除数据源")
async def delete_datasource(
    ds_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DataSourceService = Depends(get_datasource_service),
) -> dict:
    ok = await service.delete(ctx.tenant_id, ds_id)
    return success({"deleted": ok, "id": ds_id}, trace_id=ctx.trace_id)


@router.post("/datasources/{ds_id}/test", summary="连接测试")
async def test_datasource(
    ds_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: DataSourceService = Depends(get_datasource_service),
) -> dict:
    result = await service.test_connection(ctx.tenant_id, ds_id)
    return success(result.model_dump(), trace_id=ctx.trace_id)
