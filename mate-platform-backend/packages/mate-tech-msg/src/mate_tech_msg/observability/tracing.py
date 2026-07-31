"""OpenTelemetry trace integration (ST-5.1.7).

consumer 与 producer 跨服务 trace 关联。
"""
from __future__ import annotations

import os
from typing import Any

import structlog
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = structlog.get_logger(__name__)


def init_tracing(service_name: str | None = None) -> trace.Tracer:
    """初始化 OTel tracing.

    Args:
        service_name: 服务名（默认 mate-tech-msg）

    Returns:
        OpenTelemetry Tracer 实例
    """
    name = service_name or os.getenv("OTEL_SERVICE_NAME", "mate-tech-msg")
    resource = Resource.create({SERVICE_NAME: name})
    provider = TracerProvider(resource=resource)

    # OTLP exporter（如 endpoint 设置）
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        logger.info("otel.otlp.exporter.added", endpoint=endpoint)

    trace.set_tracer_provider(provider)
    return trace.get_tracer(name)


def get_tracer(name: str = "mate-tech-msg") -> trace.Tracer:
    """获取当前 tracer."""
    return trace.get_tracer(name)


def inject_trace_headers(carrier: dict[str, Any]) -> None:
    """把当前 span context 注入 carrier（Kafka headers 用）."""
    from opentelemetry.propagate import inject
    inject(carrier)


def extract_trace_context(headers: list[tuple[str, bytes | str]]) -> dict[str, str]:
    """从 Kafka headers 提取 trace context."""
    from opentelemetry.propagate import extract
    carrier = {k: v.decode() if isinstance(v, bytes) else v for k, v in headers}
    return extract(carrier)
