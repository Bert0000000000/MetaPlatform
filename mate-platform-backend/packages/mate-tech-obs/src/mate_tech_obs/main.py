"""Mate Platform - Tech OBS main entry.

Wires the 3 integration hooks per ADR-0014:
  1. install_auth(app) from mate_platform.auth (SEC-IAM-01).
  2. require_tenant(ctx) at every non-/healthz non-/metrics handler
     (SEC-TENANT-01).
  3. (future) outbox.append(event) for write endpoints.

Note: /healthz and /metrics are anonymous by design (PROBE endpoints
that any k8s liveness / readiness / Prometheus can hit without auth).
The auth middleware in mate_platform.auth already whitelists
/healthz; we add /metrics to the same whitelist at the
AuthMiddleware level (see ADR-0011 §2.4 + the existing
ANONYMOUS_PATHS constant).
"""
from __future__ import annotations

import os

import structlog
from fastapi import FastAPI, HTTPException, Request, Response

# TECH-SERVICES / BUSINESS-SLICES: hooks 1, 2.
from mate_platform.auth import install_auth
from mate_platform.tenancy.guards import require_tenant

from .admin import router as admin_router
from .admin.alert_rule_routes import router as alert_rule_management_router
from .admin.alert_rule_routes import _set_outbox as _share_alert_rule_outbox
from .admin.alert_rule_routes import _set_store as _share_alert_rule_store
from .alerts.management import AlertRuleStore
from .dashboards.routes import router as dashboard_config_router
from .dashboards.routes import _set_store as _share_dashboard_config_store
from .dashboards.store import DashboardConfigStore
from .health.aggregator import aggregate_health
from .metrics.prom import render_metrics
from .tracing.instrument import auto_instrument
from .tracing.logging import configure_json_logging
from .tracing.otel import init_tracing

logger = structlog.get_logger(__name__)

configure_json_logging(os.getenv("LOG_LEVEL", "INFO"))
init_tracing(os.getenv("OTEL_SERVICE_NAME", "mate-tech-obs"))

# 扩展能力 (backlog §3.7): Alertmanager 告警规则管理 (写) in-memory store.
alert_rule_store = AlertRuleStore()
_share_alert_rule_store(alert_rule_store)
# Outbox writer is optional — None in test profile; production wires
# the InMemoryOutboxWriter or SQL-backed writer at startup.
_share_alert_rule_outbox(None)

# 扩展能力: 自定义仪表盘配置 (写) in-memory store.
dashboard_config_store = DashboardConfigStore()
_share_dashboard_config_store(dashboard_config_store)

app = FastAPI(
    title="mate-tech-obs",
    version="0.1.0",
    description="Observability aggregation (OTel + Prometheus + Loki + Tempo)",
)

# Hook 1 of 5: install auth middleware (SEC-IAM-01).
install_auth(app)

_INSTRUMENT_RESULT = auto_instrument(app)


def _require_ctx(request: Request):
    """Defence in depth: ctx should already be set by install_auth."""
    ctx = getattr(request.state, "ctx", None)
    if ctx is None:
        raise HTTPException(status_code=401, detail="no auth context")
    return ctx


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Anonymous — k8s liveness probe.

    Whitelisted by AuthMiddleware.ANONYMOUS_PATHS in
    mate_platform.auth.middleware.
    """
    return {"status": "ok", "version": app.version}


@app.get("/metrics")
async def metrics_endpoint() -> Response:
    """Anonymous — Prometheus scrape.

    Whitelisted by AuthMiddleware.ANONYMOUS_PATHS. (In production,
    the Prometheus server IP-range is enforced at NetworkPolicy
    level; the path is anonymous to make scrape config simpler.)
    """
    body, content_type = render_metrics()
    return Response(content=body, media_type=content_type)


@app.get("/api/v1/obs/health")
async def health_aggregate(request: Request) -> dict[str, object]:
    """Per-tenant health view. Tenant guard at the top."""
    ctx = _require_ctx(request)
    require_tenant(ctx)
    report = await aggregate_health()
    return report.to_dict()


@app.get("/api/v1/obs/instrument")
async def instrument_status(request: Request) -> dict[str, object]:
    """Per-tenant instrumentation status."""
    ctx = _require_ctx(request)
    require_tenant(ctx)
    return {"instrumented": _INSTRUMENT_RESULT, "tenant_id": ctx.tenant_id}


app.include_router(admin_router)
# 扩展能力 (backlog §3.7): Alertmanager 告警规则管理 (写) endpoints.
app.include_router(alert_rule_management_router)
# 扩展能力: 自定义仪表盘配置 (写) endpoints.
app.include_router(dashboard_config_router)


@app.on_event("startup")  # pyright: ignore[reportDeprecated]
async def on_startup() -> None:
    logger.info("mate-tech-obs.startup", version=app.version, instrumented=_INSTRUMENT_RESULT)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8083")))  # noqa: S104
