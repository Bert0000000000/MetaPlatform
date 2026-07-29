"""Prometheus /metrics (ST-5.2.4)."""
from __future__ import annotations

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.05, 0.1, 0.5, 1, 5),
)

IN_FLIGHT = Gauge(
    "http_requests_in_flight",
    "Current in-flight HTTP requests",
    ["method", "endpoint"],
)


def render_metrics() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST


def get_registry() -> CollectorRegistry:
    from prometheus_client import REGISTRY  # noqa: PLC0415
    return REGISTRY
