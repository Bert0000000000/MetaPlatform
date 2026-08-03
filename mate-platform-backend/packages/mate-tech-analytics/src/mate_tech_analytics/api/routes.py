"""Analytics endpoints (overview / usage / users / services / trends).

Every handler enforces the two BUSINESS-SLICES integration hooks:
  - _require_ctx: the auth middleware (install_auth) must have resolved a
    RequestContext; otherwise 401.
  - require_tenant(ctx): hard rule 3 -- no tenant context, no data access.
    TenantAccessError is mapped to 400 by install_auth's exception handler.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from mate_platform.tenancy.guards import require_tenant

from .. import repositories
from ..models import (
    OverviewStats,
    ServiceRankingResponse,
    TrendResponse,
    UsageResponse,
    UserActivityResponse,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def _require_ctx(request: Request):
    """Defence in depth: ctx should already be set by install_auth."""
    ctx = getattr(request.state, "ctx", None)
    if ctx is None:
        raise HTTPException(status_code=401, detail="no auth context")
    return ctx


@router.get(
    "/overview",
    response_model=OverviewStats,
    operation_id="analyticsGetOverview",
    summary="Platform overview (users / apps / requests / tenants)",
)
async def analytics_get_overview(
    request: Request,
    days: int = Query(7, ge=1, le=30, description="lookback window in days"),
) -> OverviewStats:
    ctx = _require_ctx(request)
    tenant_id = require_tenant(ctx)
    return repositories.get_overview(tenant_id, days)


@router.get(
    "/usage",
    response_model=UsageResponse,
    operation_id="analyticsGetUsage",
    summary="API usage by service over the window",
)
async def analytics_get_usage(
    request: Request,
    days: int = Query(7, ge=1, le=30, description="lookback window in days"),
) -> UsageResponse:
    ctx = _require_ctx(request)
    tenant_id = require_tenant(ctx)
    return repositories.get_usage(tenant_id, days)


@router.get(
    "/users",
    response_model=UserActivityResponse,
    operation_id="analyticsGetUsers",
    summary="User activity (DAU / new users / MAU / growth)",
)
async def analytics_get_users(
    request: Request,
    days: int = Query(7, ge=1, le=30, description="lookback window in days"),
) -> UserActivityResponse:
    ctx = _require_ctx(request)
    tenant_id = require_tenant(ctx)
    return repositories.get_users(tenant_id, days)


@router.get(
    "/services",
    response_model=ServiceRankingResponse,
    operation_id="analyticsGetServices",
    summary="Service call ranking (requests / latency / error rate)",
)
async def analytics_get_services(
    request: Request,
    days: int = Query(7, ge=1, le=30, description="lookback window in days"),
) -> ServiceRankingResponse:
    ctx = _require_ctx(request)
    tenant_id = require_tenant(ctx)
    return repositories.get_services(tenant_id, days)


@router.get(
    "/trends",
    response_model=TrendResponse,
    operation_id="analyticsGetTrends",
    summary="Trend series (requests / tokens / storage growth)",
)
async def analytics_get_trends(
    request: Request,
    days: int = Query(7, ge=1, le=30, description="lookback window in days"),
) -> TrendResponse:
    ctx = _require_ctx(request)
    tenant_id = require_tenant(ctx)
    return repositories.get_trends(tenant_id, days)
