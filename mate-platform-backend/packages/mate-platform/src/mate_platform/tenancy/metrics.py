"""Prometheus metric definitions for the tenancy layer.

Exposes ``mate_platform.tenancy.cross_tenant_attempt`` counter
(ADR-0018 §2.1: P0 single-shot alert on any cross-tenant attempt).
The counter is lazy-initialized so unit tests that don't pull in
prometheus_client can still import this module.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from prometheus_client import Counter

_counter: "Counter | None" = None


def cross_tenant_attempt() -> "Counter | None":
    """Return the singleton counter (None if prometheus_client missing)."""
    global _counter
    if _counter is not None:
        return _counter
    try:
        from prometheus_client import Counter as _C
    except ImportError:
        return None
    _counter = _C(
        "mate_platform_tenancy_cross_tenant_attempt_total",
        "Number of times a tenant guard refused a request (hard rule 3).",
        labelnames=("reason", "tenant_id"),
    )
    return _counter


__all__ = ["cross_tenant_attempt"]