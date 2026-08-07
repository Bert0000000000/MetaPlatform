"""mate_app_hub.main — FastAPI application factory.

`create_app()` returns a fully-wired FastAPI app:
  * `install_auth(app)` — bearer-token middleware (ADR-0014 step 1)
  * The apphub router under `/api/v1/apphub/*`

The package does not own persistent state, telemetry exporters,
or a process supervisor — those are layered in by the host
container / platform bundle (out of scope for P2-W2).
"""
from __future__ import annotations

from fastapi import FastAPI, Response

from mate_platform.auth import install_auth
from mate_platform.messaging.outbox import InMemoryOutboxWriter

from .api import router as apphub_router
from .marketplace import install_marketplace_state, router as marketplace_router


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
    install_auth(app, extra_anonymous_paths={"/healthz"})

    @app.get("/healthz")
    async def healthz() -> Response:
        return Response(content='{"status":"ok"}', media_type="application/json")

    # Step 3: default outbox writer (no-op until a test attaches one).
    if not hasattr(app.state, "outbox_writer"):
        app.state.outbox_writer = InMemoryOutboxWriter()
    app.include_router(apphub_router)
    # Marketplace 域（browse/install/installed）挂载到 apphub（gateway /marketplace → apphub）
    install_marketplace_state(app)
    app.include_router(marketplace_router)
    return app


app = create_app()
