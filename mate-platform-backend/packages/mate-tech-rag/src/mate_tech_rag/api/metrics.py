"""P2.11 SLO basic metrics: lightweight per-endpoint latency tracking.

Goal: meet "runbook says RAG TTFT p95<=1.5s" with at least a working
metric, not a full Prometheus stack. We track per-endpoint:

  - count: total calls
  - sum_ms: running total of latency in ms
  - avg_ms: sum_ms / count
  - last_latency_ms: latency of the most recent call
  - p95_recent: p95 over the last N calls (sliding window; default 32)

This is intentionally simple - it does not bound memory (each bucket
keeps at most ``window_size`` floats) and uses a process-global
``app.state.metrics`` dict that the FastAPI app constructor seeds.
"""
from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass, field
from typing import Deque


def _percentile(values: list[float], p: float) -> float:
    """Return the ``p``-th percentile of ``values`` (0..100).

    Uses the nearest-rank method. Returns 0.0 for empty input.
    """
    if not values:
        return 0.0
    sorted_v = sorted(values)
    rank = (p / 100.0) * (len(sorted_v) - 1)
    lower = int(rank)
    upper = min(lower + 1, len(sorted_v) - 1)
    frac = rank - lower
    return sorted_v[lower] * (1 - frac) + sorted_v[upper] * frac


@dataclass
class LatencyBucket:
    """Sliding-window latency counter.

    Thread-safe. Use ``observe(ms)`` to record a measurement and
    ``snapshot()`` to read the current window state.
    """

    name: str
    window_size: int = 32
    _count: int = 0
    _sum_ms: float = 0.0
    _last_ms: float = 0.0
    _window: Deque[float] = field(default_factory=lambda: deque(maxlen=32))
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def observe(self, latency_ms: float) -> None:
        if latency_ms < 0:
            latency_ms = 0.0
        with self._lock:
            self._count += 1
            self._sum_ms += latency_ms
            self._last_ms = latency_ms
            self._window.append(float(latency_ms))

    def snapshot(self) -> dict[str, float | int]:
        with self._lock:
            window_snapshot = list(self._window)
            count = self._count
            sum_ms = self._sum_ms
            last = self._last_ms
        avg = (sum_ms / count) if count > 0 else 0.0
        p95 = _percentile(window_snapshot, 95.0)
        return {
            "count": int(count),
            "sum_ms": float(sum_ms),
            "avg_ms": float(avg),
            "last_latency_ms": float(last),
            "p95_recent": float(p95),
        }

    def reset(self) -> None:
        with self._lock:
            self._count = 0
            self._sum_ms = 0.0
            self._last_ms = 0.0
            self._window.clear()


def make_default_buckets(window_size: int = 32) -> dict[str, LatencyBucket]:
    """Return a fresh metrics map with the three endpoint buckets the
    runbook cares about (ingest / search / upload)."""
    return {
        "ingest": LatencyBucket(name="ingest", window_size=window_size),
        "search": LatencyBucket(name="search", window_size=window_size),
        "upload": LatencyBucket(name="upload", window_size=window_size),
    }
