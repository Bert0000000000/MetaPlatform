"""Mate Platform - Tech OBS main entry."""
from __future__ import annotations

import os

import structlog
from fastapi import FastAPI, Response

from .admin import router as admin_router
from .health.aggregator import aggregate_health
from .metrics.prom import render_metrics
from .tracing.instrument import auto_instrument
from .tracing.logging import configure_json_logging
from .tracing.otel import init_tracing

logger = structlog.get_logger(__name__)

configure_json_logging(os.getenv("LOG_LEVEL", "INFO"))
init_tracing(os.getenv("OTEL_SERVICE_NAME", "mate-tech-obs"))

app = FastAPI(
    title="mate-tech-obs",
    version="0.1.0",
    description="Observability aggregation (OTel + Prometheus + Loki + Tempo)",
)

_INSTRUMENT_RESULT = auto_instrument(app)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": app.version}


@app.get("/metrics")
async def metrics_endpoint() -> Response:
    body, content_type = render_metrics()
    return Response(content=body, media_type=content_type)


@app.get("/api/v1/obs/health")
async def health_aggregate() -> dict[str, object]:
    report = await aggregate_health()
    return report.to_dict()


@app.get("/api/v1/obs/instrument")
async def instrument_status() -> dict[str, object]:
    return {"instrumented": _INSTRUMENT_RESULT}


app.include_router(admin_router)

@app.on_event("startup")  # pyright: ignore[reportDeprecated]
async def on_startup() -> None:
    logger.info("mate-tech-obs.startup", version=app.version, instrumented=_INSTRUMENT_RESULT)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8083")))  # noqa: S104
