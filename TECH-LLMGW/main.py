"""TECH-LLMGW FastAPI application entry point."""

from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.common.middleware import (
    install_exception_handlers,
    install_trace_id_middleware,
)
from app.config import settings
from app.deps import get_registry

app = FastAPI(
    title="TECH-LLMGW",
    description="LLM Gateway Service for Mate Platform (Phase 2)",
    version="0.2.0",
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