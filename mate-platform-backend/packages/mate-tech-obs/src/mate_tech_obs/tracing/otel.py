"""OTel SDK 初始化 (ST-5.2.1)."""
from __future__ import annotations

import os
from collections.abc import Callable
from functools import wraps
from typing import Any

import structlog
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

logger = structlog.get_logger(__name__)


def init_tracing(
    service_name: str | None = None,
    *,
    console_export: bool = False,
) -> trace.Tracer:
    name = service_name or os.getenv("OTEL_SERVICE_NAME", "mate-tech-obs")
    resource = Resource.create({SERVICE_NAME: name})
    provider = TracerProvider(resource=resource)

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        logger.info("otel.otlp.exporter.added", endpoint=endpoint, service=name)

    if console_export:
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)
    return trace.get_tracer(name)


def get_tracer(name: str = "mate-tech-obs") -> trace.Tracer:
    return trace.get_tracer(name)


def traced(name: str | None = None) -> Callable:
    """ST-5.2.3 自定义 span 装饰器."""
    def decorator(fn: Callable) -> Callable:
        span_name = name or f"{fn.__module__}.{fn.__qualname__}"
        tracer = get_tracer()

        if callable(fn) and hasattr(fn, "__await__"):
            @wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                with tracer.start_as_current_span(span_name) as span:
                    for k, v in kwargs.items():
                        if isinstance(v, (str, int, float, bool)):
                            span.set_attribute(f"fn.{k}", v)
                    return await fn(*args, **kwargs)
            return async_wrapper
        else:
            @wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                with tracer.start_as_current_span(span_name) as span:
                    for k, v in kwargs.items():
                        if isinstance(v, (str, int, float, bool)):
                            span.set_attribute(f"fn.{k}", v)
                    return fn(*args, **kwargs)
            return sync_wrapper

    return decorator
