"""Schema discovery endpoints (S-DATA-03)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_schema_discovery_service
from app.services.schema_discovery_service import SchemaDiscoveryService

router = APIRouter(tags=["schema"])


@router.get("/datasources/{ds_id}/schemas", summary="数据库列表")
async def list_schemas(
    ds_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: SchemaDiscoveryService = Depends(get_schema_discovery_service),
) -> dict:
    dbs = await service.list_databases(ctx.tenant_id, ds_id)
    items = [d.model_dump() for d in dbs]
    return success({"items": items, "total": len(items)}, trace_id=ctx.trace_id)


@router.get(
    "/datasources/{ds_id}/schemas/{db}/tables", summary="表列表"
)
async def list_tables(
    ds_id: str,
    db: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: SchemaDiscoveryService = Depends(get_schema_discovery_service),
) -> dict:
    tables = await service.list_tables(ctx.tenant_id, ds_id, db)
    items = [t.model_dump() for t in tables]
    return success({"items": items, "total": len(items)}, trace_id=ctx.trace_id)


@router.get(
    "/datasources/{ds_id}/schemas/{db}/tables/{table}/columns",
    summary="字段列表",
)
async def list_columns(
    ds_id: str,
    db: str,
    table: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    service: SchemaDiscoveryService = Depends(get_schema_discovery_service),
) -> dict:
    columns = await service.list_columns(ctx.tenant_id, ds_id, db, table)
    items = [c.model_dump() for c in columns]
    return success({"items": items, "total": len(items)}, trace_id=ctx.trace_id)
