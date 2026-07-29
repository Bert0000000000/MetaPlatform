"""自动 instrument (ST-5.2.2)."""
from __future__ import annotations

import structlog

logger = structlog.get_logger(__name__)


def auto_instrument(app: object | None = None) -> dict[str, bool]:
    results: dict[str, bool] = {}

    if app is not None:
        try:
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # noqa: PLC0415
            FastAPIInstrumentor.instrument_app(app)  # type: ignore[arg-type]
            results["fastapi"] = True
        except Exception as e:
            logger.warning("instrument.fastapi.failed", error=str(e))
            results["fastapi"] = False

    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor  # noqa: PLC0415
        HTTPXClientInstrumentor().instrument()
        results["httpx"] = True
    except Exception as e:
        logger.warning("instrument.httpx.failed", error=str(e))
        results["httpx"] = False

    try:
        from opentelemetry.instrumentation.aiokafka import AIOKafkaInstrumentor  # noqa: PLC0415
        AIOKafkaInstrumentor().instrument()
        results["aiokafka"] = True
    except Exception as e:
        logger.warning("instrument.aiokafka.failed", error=str(e))
        results["aiokafka"] = False

    logger.info("instrument.done", results=results)
    return results
