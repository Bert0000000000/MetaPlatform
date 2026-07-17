"""TECH-RAG FastAPI application entry point."""

from __future__ import annotations

import asyncio
import logging

import uvicorn
from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.common.middleware import (
    install_exception_handlers,
    install_trace_id_middleware,
)
from app.config import settings
from app.deps import get_registry

logger = logging.getLogger("techrag")

app = FastAPI(
    title="TECH-RAG",
    description="RAG Engine Service for Mate Platform",
    version="0.1.0",
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
    return {"status": "UP"}


# ----------------------------------------------------------- Outbox relay
#
# Background task that polls PENDING outbox events every N seconds and
# dispatches them to Kafka (P1-RAG-07).

_relay_task: asyncio.Task | None = None


async def _outbox_relay_loop() -> None:
    """Periodically relay pending outbox events to Kafka."""
    interval = settings.kafka_relay_interval_seconds
    event_service = app.state.registry.event_service
    while True:
        try:
            relayed = await event_service.relay_events()
            if relayed:
                logger.info("outbox_relay relayed=%d", relayed)
        except Exception:
            logger.warning("outbox_relay error", exc_info=True)
        await asyncio.sleep(interval)


@app.on_event("startup")
async def _start_relay() -> None:
    global _relay_task
    _relay_task = asyncio.create_task(_outbox_relay_loop())
    logger.info("outbox_relay_started interval=%.1fs", settings.kafka_relay_interval_seconds)


@app.on_event("shutdown")
async def _stop_relay() -> None:
    global _relay_task
    if _relay_task is not None:
        _relay_task.cancel()
        _relay_task = None
        logger.info("outbox_relay_stopped")


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=settings.reload)
