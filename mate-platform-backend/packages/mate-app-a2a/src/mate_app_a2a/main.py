"""mate_app_a2a.main — FastAPI application factory.

`create_app()` returns a fully-wired FastAPI app:
  * `install_auth(app)` — bearer-token middleware (ADR-0014 step 1)
  * The a2a router under `/api/v1/a2a/*`

The `/api/v1/a2a/health` endpoint is widened into the anonymous set
so liveness probes can reach it without a bearer token.
"""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api import router as a2a_router
from .bootstrap.agent_registration import register_deerflow_at_startup_if_enabled


def create_app() -> FastAPI:
    """Build the a2a FastAPI application."""
    app = FastAPI(
        title="mate-app-a2a",
        version="0.1.0",
        description="Agent-to-Agent protocol center",
    )
    # Step 1 of ADR-0014 5-step pattern: install bearer-token auth
    # middleware. The health endpoint is anonymous so liveness probes
    # work without a bearer token; all other endpoints read
    # tenant-bound state via require_tenant.
    install_auth(app, extra_anonymous_paths={"/api/v1/a2a/health"})
    app.include_router(a2a_router)
    # Auto-register the DeerFlow deep-research agent so it is available
    # without manual configuration (PR-3).
    register_deerflow_at_startup_if_enabled()
    return app


app = create_app()
