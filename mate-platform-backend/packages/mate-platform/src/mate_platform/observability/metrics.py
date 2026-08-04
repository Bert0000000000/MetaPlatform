"""Lightweight dict-based counter for metrics that don't need the full OTel SDK.

The OTel meter provider is still configured by the OTel SDK for
production traces; this module provides a simple fallback for
unit-tested code paths that need a counter without pulling in the
full observability stack.
"""
from __future__ import annotations


class SimpleCounter:
    """Minimal counter backed by an int — no OTel SDK dependency."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._value: int = 0

    def inc(self, n: int = 1) -> None:
        self._value += n

    def value(self) -> int:
        return self._value


_counters: dict[str, SimpleCounter] = {}


def get_counter(name: str) -> SimpleCounter:
    """Return (or lazily create) the named counter."""
    if name not in _counters:
        _counters[name] = SimpleCounter(name)
    return _counters[name]


def setup_metrics() -> None:
    """No-op placeholder; the OTel meter provider is configured by the OTel SDK."""
    return None
