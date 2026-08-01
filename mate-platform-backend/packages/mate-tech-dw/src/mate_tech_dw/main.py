"""mate_tech_dw.main — FastAPI application factory.

`create_app()` returns a fully-wired FastAPI app:
  * `install_auth(app)` — bearer-token middleware (ADR-0014 step 1)
  * The dw router under `/api/v1/dw/*`

P2-W3: in-memory repository only. Persistent storage and
cross-service aggregation land in P2-W5 (TD-6).
"""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api import router as dw_router


def create_app() -> FastAPI:
    """Build the mate-tech-dw FastAPI application."""
    app = FastAPI(
        title="mate-tech-dw",
        version="0.1.0",
        description=(
            "Mate Platform - TECH-DW digital workforce aggregation "
            "query (FR-DW-001..015)."
        ),
    )
    # Step 1 of ADR-0014 5-step pattern: install bearer-token auth
    # middleware. All dw endpoints read tenant-bound state, so none
    # of them is widened into the anonymous set.
    install_auth(app)
    app.include_router(dw_router)
    return app


app = create_app()
