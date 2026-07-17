"""Catalog endpoints (P3-DATA-05)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.catalog.schemas import AssetType
from app.catalog.service import CatalogService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.common.errors import InvalidParamError
from app.deps import get_catalog_service

router = APIRouter(tags=["catalog"])


def _parse_type(value: Optional[str]) -> Optional[AssetType]:
    if value is None:
        return None
    try:
        return AssetType(value.upper())
    except ValueError:
        return None


@router.get("/catalog/assets", summary="数据资产列表")
async def list_assets(
    request: Request,
    assetType: Optional[str] = Query(default=None),
    layer: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: CatalogService = Depends(get_catalog_service),
) -> dict:
    data = await service.list(
        ctx.tenant_id,
        asset_type=_parse_type(assetType),
        layer=layer,
        keyword=keyword,
        page=page,
        page_size=pageSize,
    )
    return success(data, trace_id=ctx.trace_id)


@router.get("/catalog/assets/{asset_id}", summary="数据资产详情")
async def get_asset(
    asset_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CatalogService = Depends(get_catalog_service),
) -> dict:
    try:
        asset = await service.detail(ctx.tenant_id, asset_id)
    except LookupError:
        raise InvalidParamError(
            f"数据资产不存在: id={asset_id}", data={"id": asset_id}
        )
    return success(asset.model_dump(), trace_id=ctx.trace_id)


@router.get("/catalog/assets/{asset_id}/metadata", summary="资产元数据")
async def get_metadata(
    asset_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CatalogService = Depends(get_catalog_service),
) -> dict:
    try:
        meta = await service.metadata(ctx.tenant_id, asset_id)
    except LookupError:
        raise InvalidParamError(
            f"数据资产不存在: id={asset_id}", data={"id": asset_id}
        )
    return success(meta.model_dump(), trace_id=ctx.trace_id)


@router.get("/catalog/assets/{asset_id}/lineage", summary="资产血缘")
async def get_lineage(
    asset_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CatalogService = Depends(get_catalog_service),
) -> dict:
    try:
        lineage = await service.lineage(ctx.tenant_id, asset_id)
    except LookupError:
        raise InvalidParamError(
            f"数据资产不存在: id={asset_id}", data={"id": asset_id}
        )
    return success(lineage.model_dump(), trace_id=ctx.trace_id)


@router.get("/catalog/assets/{asset_id}/profile", summary="资产画像")
async def get_profile(
    asset_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: CatalogService = Depends(get_catalog_service),
) -> dict:
    try:
        profile = await service.profile(ctx.tenant_id, asset_id)
    except LookupError:
        raise InvalidParamError(
            f"数据资产不存在: id={asset_id}", data={"id": asset_id}
        )
    return success(profile.model_dump(), trace_id=ctx.trace_id)


@router.get("/catalog/search", summary="资产搜索")
async def search(
    request: Request,
    q: str = Query(..., min_length=1),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    ctx: RequestContext = Depends(request_context_dep),
    service: CatalogService = Depends(get_catalog_service),
) -> dict:
    data = await service.search(
        ctx.tenant_id, q, page=page, page_size=pageSize
    )
    return success(data, trace_id=ctx.trace_id)