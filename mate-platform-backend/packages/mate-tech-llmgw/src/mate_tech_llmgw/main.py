"""Mate Platform - Tech LLM Gateway main entry.

ST-5.5.1.2: main.py + /healthz
ST-5.5.9.1: 注册 /api/v1/llm/* 路由
"""
from __future__ import annotations

import os

import structlog
from fastapi import FastAPI

from .api.routes import router as llm_router

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="mate-tech-llmgw",
    version="0.1.0",
    description="LLM Gateway: multi-provider routing, quota, cache, fallback",
)

app.include_router(llm_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """ST-5.5.1.2 DoD: 健康检查."""
    return {"status": "ok", "version": app.version}


@app.on_event("startup")
async def on_startup() -> None:
    """lifespan 钩子."""
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
    uvicorn.run(app, host="0.0.0.0", port=8008)