"""mate_tech_etl.main — FastAPI application factory.

`create_app()` returns a fully-wired FastAPI app:
  * `install_auth(app)` — bearer-token middleware (ADR-0014 step 1)
  * The etl router under `/api/v1/etl/*`

The `/api/v1/etl/health` endpoint is widened into the anonymous set
so liveness probes can reach it without a bearer token; all other
endpoints read tenant-bound state via `require_tenant`.
"""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api import router as etl_router


def create_app() -> FastAPI:
    """Build the ETL task control FastAPI application."""
    app = FastAPI(
        title="mate-tech-etl",
        version="0.1.0",
        description="ETL task control plane (tasks CRUD + run/stop/status)",
    )
    # Step 1 of ADR-0014 5-step pattern.
    install_auth(app, extra_anonymous_paths={"/api/v1/etl/health"})
    app.include_router(etl_router)
    return app


app = create_app()
