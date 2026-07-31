"""mate_app_hub.main — FastAPI application factory.

`create_app()` returns a fully-wired FastAPI app:
  * `install_auth(app)` — bearer-token middleware (ADR-0014 step 1)
  * The apphub router under `/api/v1/apphub/*`

The package does not own persistent state, telemetry exporters,
or a process supervisor — those are layered in by the host
container / platform bundle (out of scope for P2-W2).
"""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api import router as apphub_router


def create_app() -> FastAPI:
    """Build the apphub FastAPI application."""
    app = FastAPI(
        title="mate-app-hub",
        version="0.1.0",
        description=(
            "Mate Platform - APP-HUB application registry / grouping / "
            "module catalog / page templates (FR-APP-HUB-001..005)."
        ),
    )
    # Step 1 of ADR-0014 5-step pattern: install bearer-token auth
    # middleware. The five apphub endpoints all read tenant-bound
    # state, so none of them is widened into the anonymous set.
    install_auth(app)
    app.include_router(apphub_router)
    return app


app = create_app()
