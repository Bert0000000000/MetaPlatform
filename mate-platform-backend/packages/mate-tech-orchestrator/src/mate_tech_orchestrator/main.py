"""mate_tech_orchestrator.main — FastAPI application factory.

Wires the orchestrator: bearer auth (ADR-0014 step 1), the role
registry + dispatcher + plan runner, an outbox writer for
``orchestrator.*`` events, and the API router under
``/api/v1/orchestrator/*``.
"""
from __future__ import annotations

from fastapi import FastAPI

from mate_platform.auth import install_auth
from mate_platform.messaging.outbox import InMemoryOutboxWriter

from .api.app import router as orchestrator_router
from .api.scheduling import router as scheduling_router
from .bootstrap import seed_default_roles
from .scheduler.dispatcher import get_dispatcher
from .scheduler.plan_runner import get_plan_runner
from .scheduler.role_registry import get_role_registry


def create_app() -> FastAPI:
    """Build the orchestrator FastAPI application."""
    app = FastAPI(
        title="mate-tech-orchestrator",
        version="0.1.0",
        description="Multi-role digital-employee dynamic scheduling over MCP/A2A centers",
    )
    install_auth(app, extra_anonymous_paths={"/healthz"})

    # Wire the scheduler singletons (DI seam for tests via set_* / app.state).
    registry = get_role_registry()
    registry.restore()  # reload persisted roles (cross-restart survival)
    # Seed default skill capabilities (idempotent) so App role can search/read skills.
    seed_default_roles()
    app.state.role_registry = registry
    app.state.dispatcher = get_dispatcher()
    app.state.plan_runner = get_plan_runner()
    app.state.outbox_writer = InMemoryOutboxWriter()

    app.include_router(orchestrator_router)
    app.include_router(scheduling_router)

    return app


app = create_app()


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness probe (anonymous via install_auth extra paths)."""
    return {"status": "ok", "service": "mate-tech-orchestrator"}
