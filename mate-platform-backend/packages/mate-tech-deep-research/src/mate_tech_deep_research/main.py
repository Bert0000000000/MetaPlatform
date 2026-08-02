"""FastAPI application factory for mate-tech-deep-research.

ADR-0014 5-step pattern:
  * Step 1: `install_auth(app)` is the first wiring call in `create_app()`.
  * Step 2: every handler calls `require_tenant(ctx)` (see api/router.py).
  * Step 3: handlers emit outbox events via `app.state.outbox_writer`.
  * Step 4: DeerFlow Engine outbound calls use BearerAuth (deerflow/client.py).
  * Step 5: cross-tenant negative tests in tests/test_tenant_integration.py.
"""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth
from mate_platform.messaging.outbox import InMemoryOutboxWriter

from .api.router import router


def create_app() -> FastAPI:
    """Build the mate-tech-deep-research FastAPI application."""
    app = FastAPI(
        title="mate-tech-deep-research",
        version="0.1.0",
        description="A2A Deep Research agent backed by DeerFlow Engine",
    )
    # Step 1 of ADR-0014: bearer-token auth middleware. The /healthz
    # endpoint is part of the DEFAULT anonymous set so liveness probes
    # work without a bearer token.
    install_auth(app)
    app.include_router(router)
    # Default in-memory outbox; production overrides with the SQL writer
    # bound to the request-scoped transaction. Tests can swap this out.
    app.state.outbox_writer = InMemoryOutboxWriter()

    @app.get("/healthz", tags=["health"])
    async def healthz() -> dict[str, str]:
        """Anonymous liveness probe."""
        return {"status": "ok"}

    return app


app = create_app()
