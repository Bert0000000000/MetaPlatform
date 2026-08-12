"""mate_tech_data.main — FastAPI application factory.

`create_app()` returns a fully-wired FastAPI app:
  * `install_auth(app)` — bearer-token middleware (ADR-0014 step 1)
  * The data router under `/api/v1/data/*`

The `/api/v1/data/health` endpoint is widened into the anonymous set
so liveness probes can reach it without a bearer token; all other
endpoints read tenant-bound state via `require_tenant`.
"""
from __future__ import annotations

import os

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api import router as data_router


def _bootstrap_sql() -> None:
    """SQL 模式（MATE_DB_URL / DATABASE_URL 已设置）下建表并 seed 默认租户。"""
    if not (os.environ.get("MATE_DB_URL") or os.environ.get("DATABASE_URL")):
        return
    from mate_tech_db.base import create_all
    from .repositories.sql_store import seed_from_inmemory
    create_all()
    for tenant in ("tenant-default",):
        seed_from_inmemory(tenant)


def create_app() -> FastAPI:
    """Build the data platform FastAPI application."""
    app = FastAPI(
        title="mate-tech-data",
        version="0.1.0",
        description="Data platform control plane (CDC tasks + data sources)",
    )
    # Step 1 of ADR-0014 5-step pattern: install bearer-token auth
    # middleware. The health endpoint is anonymous so liveness probes
    # work without a bearer token; all other endpoints read
    # tenant-bound state via require_tenant.
    install_auth(app, extra_anonymous_paths={"/api/v1/data/health"})
    _bootstrap_sql()
    app.include_router(data_router)
    return app


app = create_app()
