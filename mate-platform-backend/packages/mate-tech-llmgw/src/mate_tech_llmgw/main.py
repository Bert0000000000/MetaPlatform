"""Mate Platform - Tech LLM Gateway main entry.

Wires the 3 integration hooks per ADR-0014:
  1. install_auth(app) from mate_platform.auth (SEC-IAM-01).
  2. require_tenant(ctx) at every non-/healthz route in api/routes.py
     (the install here only wires the middleware; the per-route guard
     is in api/routes.py).
  3. (future) outbox.append(event) for usage events.
"""
from __future__ import annotations

import os

import structlog
from fastapi import FastAPI

# BUSINESS-SLICES P1 wave 2: hook 1 (auth).
from mate_platform.auth import install_auth

from .api.routes import legacy_router as legacy_llm_router
from .api.routes import router as llm_router

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="mate-tech-llmgw",
    version="0.1.0",
    description="LLM Gateway: multi-provider routing, quota, cache, fallback",
)

# Hook 1 of 5: install auth middleware (SEC-IAM-01).
install_auth(app)

# Canonical prefix is /api/v1/llmgw/* (per spec). The legacy
# /api/v1/llm/* alias is also wired for one release so existing
# callers (BFF routes, integration tests) keep working while they
# migrate to the spec-compliant path.
app.include_router(llm_router)
app.include_router(legacy_llm_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """ST-5.5.1.2 DoD: health check (anonymous, whitelisted)."""
    return {"status": "ok", "version": app.version}


@app.on_event("startup")
async def on_startup() -> None:
    """lifespan hook."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(__import__("logging"), log_level)
        ),
    )
    logger.info("mate-tech-llmgw.startup", version=app.version)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8008)  # noqa: S104