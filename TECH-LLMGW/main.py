"""TECH-LLMGW FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.common.middleware import (
    install_exception_handlers,
    install_trace_id_middleware,
)
from app.config import settings
from app.deps import get_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup when using SQLAlchemy backend."""

    if settings.database_url.startswith("postgresql"):
        from app.common.db import init_db

        # Import all ORM modules so their tables are registered on
        # ``Base.metadata`` before ``create_all`` runs.
        import app.models.orm  # noqa: F401
        import app.prompts.orm  # noqa: F401
        import app.quotas.orm  # noqa: F401
        import app.ratelimits.orm  # noqa: F401
        import app.audit.orm  # noqa: F401
        import app.cost.orm  # noqa: F401
        import app.routing.orm  # noqa: F401

        await init_db()
    yield


app = FastAPI(
    title="TECH-LLMGW",
    description="LLM Gateway Service for Mate Platform (Phase 2)",
    version="0.2.0",
    lifespan=lifespan,
)

# Install middlewares & error handlers.
install_trace_id_middleware(app)
install_exception_handlers(app)

# Attach the process-wide registry to the app state.
app.state.registry = get_registry()

# Mount the v1 API.
app.include_router(v1_router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=settings.reload)