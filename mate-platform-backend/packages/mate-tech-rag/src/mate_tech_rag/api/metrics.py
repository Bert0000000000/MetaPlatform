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

RAG_MODE=pg persistence: when a ``pg_sink`` (PgMetricsStore from
``storage/pg_ext_store.py``) is attached, every ``flush_every`` (default
10) observes the bucket flushes its accumulated delta to the
``rag_metrics`` table (accumulating upsert). ``snapshot_merged`` then
combines the PG totals with the not-yet-flushed remainder so a restart
keeps the counters. Memory-mode behaviour is unchanged.
"""
from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque


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
    ``snapshot()`` to read the current window state. With an attached
    ``pg_sink``, every ``flush_every`` observations the delta is flushed
    to PG (best-effort; a failed flush retries on the next observe) and
    ``snapshot_merged(pg_row)`` reports PG totals + the unflushed tail.
    """

    name: str
    window_size: int = 32
    pg_sink: Any = None
    flush_every: int = 10
    _count: int = 0
    _sum_ms: float = 0.0
    _last_ms: float = 0.0
    _window: Deque[float] = field(default_factory=lambda: deque(maxlen=32))
    _lock: threading.Lock = field(default_factory=threading.Lock)
    _unflushed_count: int = 0
    _unflushed_sum: float = 0.0

    def observe(self, latency_ms: float) -> None:
        if latency_ms < 0:
            latency_ms = 0.0
        with self._lock:
            self._count += 1
            self._sum_ms += latency_ms
            self._last_ms = latency_ms
            self._window.append(float(latency_ms))
            self._unflushed_count += 1
            self._unflushed_sum += float(latency_ms)
            if self.pg_sink is not None and self._unflushed_count >= max(1, self.flush_every):
                self._flush_locked()

    def _flush_locked(self) -> None:
        """Flush the pending delta to the PG sink. Caller holds the lock."""
        try:
            ok = bool(
                self.pg_sink.upsert(
                    self.name,
                    self._unflushed_count,
                    self._unflushed_sum,
                    _percentile(list(self._window), 95.0),
                )
            )
        except Exception:  # noqa: BLE001 — metrics must never break a request
            return
        if ok:
            self._unflushed_count = 0
            self._unflushed_sum = 0.0

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

    def snapshot_merged(self, pg_row: dict[str, Any] | None) -> dict[str, float | int]:
        """Snapshot combined with the persisted ``rag_metrics`` row.

        ``pg_row`` is one entry from ``PgMetricsStore.load_all()`` (or
        None in memory mode → identical to ``snapshot()``). count / sum /
        avg are PG totals plus the local unflushed remainder; p95 falls
        back to the last flushed PG value when the local window is empty
        (fresh process, pre-existing totals).
        """
        data = self.snapshot()
        if not pg_row:
            return data
        with self._lock:
            unflushed_count = self._unflushed_count
            unflushed_sum = self._unflushed_sum
        total_count = int(pg_row.get("count", 0)) + unflushed_count
        total_sum = float(pg_row.get("sum_ms", 0.0)) + unflushed_sum
        data["count"] = int(total_count)
        data["sum_ms"] = float(total_sum)
        data["avg_ms"] = float(total_sum / total_count) if total_count > 0 else 0.0
        if float(data["p95_recent"]) <= 0.0:
            data["p95_recent"] = float(pg_row.get("p95_last", 0.0))
        return data

    def reset(self) -> None:
        with self._lock:
            self._count = 0
            self._sum_ms = 0.0
            self._last_ms = 0.0
            self._window.clear()
            self._unflushed_count = 0
            self._unflushed_sum = 0.0


def make_default_buckets(
    window_size: int = 32,
    pg_sink: Any = None,
    flush_every: int = 10,
) -> dict[str, LatencyBucket]:
    """Return a fresh metrics map with the three endpoint buckets the
    runbook cares about (ingest / search / upload)."""
    return {
        "ingest": LatencyBucket(
            name="ingest", window_size=window_size, pg_sink=pg_sink, flush_every=flush_every,
        ),
        "search": LatencyBucket(
            name="search", window_size=window_size, pg_sink=pg_sink, flush_every=flush_every,
        ),
        "upload": LatencyBucket(
            name="upload", window_size=window_size, pg_sink=pg_sink, flush_every=flush_every,
        ),
    }
