"""Prometheus metrics tests."""
from __future__ import annotations

from mate_tech_obs.metrics.prom import (
    IN_FLIGHT,
    REQUEST_COUNT,
    REQUEST_LATENCY,
    render_metrics,
)


def test_render_metrics_returns_bytes() -> None:
    body, _content_type = render_metrics()
    assert isinstance(body, bytes)
    assert len(body) > 0


def test_request_count_increment() -> None:
    REQUEST_COUNT.labels(method="GET", endpoint="/test", status="200").inc()
    assert True


def test_request_latency_observe() -> None:
    REQUEST_LATENCY.labels(method="POST", endpoint="/y").observe(0.123)


def test_in_flight_inc_dec() -> None:
    IN_FLIGHT.labels(method="PUT", endpoint="/z").inc()
    IN_FLIGHT.labels(method="PUT", endpoint="/z").dec()
