"""Mate Platform - Tech MSG main entry.

ST-5.1.1.2: main.py + /healthz
ST-5.1.4: publisher 端点
"""
from __future__ import annotations

import os

import structlog
from fastapi import FastAPI, HTTPException

from .dedup import DedupStore
from .kafka_client import create_kafka_client
from .observability.tracing import init_tracing
from .publisher import Publisher
from .schemas import PublishRequest, PublishResponse

logger = structlog.get_logger(__name__)

# 模块级单例
kafka = create_kafka_client()
dedup = DedupStore()
publisher = Publisher(kafka=kafka, dedup=dedup)

# OTel 初始化
init_tracing()

app = FastAPI(
    title="mate-tech-msg",
    version="0.1.0",
    description="Message Bus service: Kafka producer / consumer + idempotency + retry",
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """ST-5.1.1.2 DoD: 健康检查."""
    return {"status": "ok", "version": app.version}


@app.post("/api/v1/msg/publish", response_model=PublishResponse)
async def publish_endpoint(req: PublishRequest) -> PublishResponse:
    """ST-5.1.4: 发布消息."""
    try:
        return await publisher.publish(req)
    except Exception as e:
        logger.error("publish.error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/msg/topics")
async def list_topics() -> dict[str, list[str]]:
    """列出常用 topics（占位 — 实际从 Kafka admin API 取）."""
    return {
        "topics": [
            "mate.msg.dlq",
            "mate.events.user",
            "mate.events.system",
            "mate.kb.ingest",
            "mate.rag.query",
        ]
    }


@app.on_event("startup")
async def on_startup() -> None:
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
    logger.info("mate-tech-msg.startup", version=app.version)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await kafka.stop_producer()
    await dedup.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8082")))
