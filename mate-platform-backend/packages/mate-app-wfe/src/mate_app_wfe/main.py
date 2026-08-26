"""mate_app_wfe.main — FastAPI application factory.

`create_app()` returns a fully-wired FastAPI app:
  * `install_auth(app)` — bearer-token middleware (ADR-0014 step 1)
  * The wfe router under `/api/v1/wfe/*`

All wfe endpoints read/write tenant-bound state, so none of them
is widened into the anonymous set.

P2-W5: in-memory BPMN structural validator only. Real Flowable 8.0
engine integration lands in P2-W6.
"""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth
from mate_platform.runtime import reject_production_fallback
from mate_platform.workflow import WorkflowSettings, build_workflow_executor

from .api import router as wfe_router
from .api import workflow_router


def create_app() -> FastAPI:
    """Build the mate-app-wfe FastAPI application."""
    reject_production_fallback("in-memory WFE state")
    app = FastAPI(
        title="mate-app-wfe",
        version="0.1.0",
        description=(
            "Mate Platform - APP-WFE workflow engine center "
            "(FR-WFE-001..002)."
        ),
    )
    workflow_settings = WorkflowSettings.from_env()
    app.state.workflow_settings = workflow_settings
    app.state.workflow_executor = build_workflow_executor(workflow_settings)
    # Step 1 of ADR-0014 5-step pattern: install bearer-token auth
    # middleware. All wfe endpoints read tenant-bound state, so none
    # of them is widened into the anonymous set.
    install_auth(app)
    app.include_router(wfe_router)
    app.include_router(workflow_router)
    return app


app = create_app()
