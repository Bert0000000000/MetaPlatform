"""Mate Platform - Analytics main entry.

Wires the integration hooks per ADR-0014:
  1. install_auth(app) from mate_platform.auth (SEC-IAM-01).
  2. require_tenant(ctx) at every /api/v1/analytics handler
     (SEC-TENANT-01, hard rule 3) -- enforced in api/routes.py.
"""
from __future__ import annotations

import os

import structlog
from fastapi import FastAPI, HTTPException, Request

# TECH-SERVICES / BUSINESS-SLICES: hooks 1, 2.
from mate_platform.auth import install_auth

from .api import router as analytics_router

logger = structlog.get_logger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="mate-tech-analytics",
        version="0.1.0",
        description="Platform analytics (overview / usage / users / services / trends)",
    )
    # Hook 1 of 5: install auth middleware (SEC-IAM-01). This also maps
    # TenantAccessError -> 400 (hard rule 3) for every package.
    install_auth(app)
    app.include_router(analytics_router)

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        """Anonymous -- k8s liveness probe (whitelisted by AuthMiddleware)."""
        return {"status": "ok", "version": app.version}

    @app.get("/api/v1/analytics/_ctx")
    async def _debug_ctx(request: Request) -> dict[str, object]:
        """Internal: surface the resolved tenant for diagnostics."""
        ctx = getattr(request.state, "ctx", None)
        if ctx is None:
            raise HTTPException(status_code=401, detail="no auth context")
        return {"tenant_id": ctx.tenant_id, "auth_method": ctx.auth_method.value}

    @app.on_event("startup")  # pyright: ignore[reportDeprecated]
    async def on_startup() -> None:
        logger.info("mate-tech-analytics.startup", version=app.version)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8084")))  # noqa: S104
