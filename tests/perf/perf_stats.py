"""Performance statistics utilities (V11-12).

Provides:
- ``PerfStats``: collects per-API timing samples and computes avg/p50/p95/p99/max.
- ``PerfReport``: formats results into a readable table and emits a pytest section.
- ``P95_THRESHOLD_MS``: default acceptance threshold (500 ms) per V11-12.

The stats use a simple percentile-with-linear-interpolation formula (compatible
with numpy.percentile default ``linear`` method) so results match production
APM tooling conventions.
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass, field
from typing import Callable, List


P95_THRESHOLD_MS = 500.0  # V11-12 验收标准：API P95 < 500ms


def _percentile(samples: List[float], pct: float) -> float:
    """Linear-interpolated percentile (matches numpy default).

    ``samples`` is sorted ascending. ``pct`` is in [0, 100].
    Returns 0.0 for empty input.
    """
    if not samples:
        return 0.0
    if len(samples) == 1:
        return samples[0]
    s = sorted(samples)
    k = (len(s) - 1) * (pct / 100.0)
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    frac = k - lo
    return s[lo] + (s[hi] - s[lo]) * frac


@dataclass
class PerfStats:
    """Collects timings (in milliseconds) for a single API endpoint.

    Use ``record_ms`` to append a measurement, or ``time_call`` as a
    context manager. Compute metrics via ``summary``.
    """

    name: str
    samples: List[float] = field(default_factory=list)

    def record_ms(self, ms: float) -> None:
        self.samples.append(float(ms))

    def reset(self) -> None:
        self.samples.clear()

    @property
    def count(self) -> int:
        return len(self.samples)

    def summary(self) -> dict:
        """Return a dict with avg/p50/p95/p99/max/min in milliseconds."""
        s = self.samples
        if not s:
            return {
                "name": self.name,
                "count": 0,
                "avg_ms": 0.0,
                "p50_ms": 0.0,
                "p95_ms": 0.0,
                "p99_ms": 0.0,
                "min_ms": 0.0,
                "max_ms": 0.0,
                "pass_p95": True,
                "threshold_ms": P95_THRESHOLD_MS,
            }
        return {
            "name": self.name,
            "count": len(s),
            "avg_ms": statistics.fmean(s),
            "p50_ms": _percentile(s, 50),
            "p95_ms": _percentile(s, 95),
            "p99_ms": _percentile(s, 99),
            "min_ms": min(s),
            "max_ms": max(s),
            "pass_p95": _percentile(s, 95) <= P95_THRESHOLD_MS,
            "threshold_ms": P95_THRESHOLD_MS,
        }


@dataclass
class PerfReport:
    """Aggregates multiple ``PerfStats`` and formats output."""

    stats: List[PerfStats] = field(default_factory=list)

    def add(self, stat: PerfStats) -> None:
        self.stats.append(stat)

    def format_table(self) -> str:
        """Render a fixed-width text table suitable for pytest output."""
        header = (
            f"{'API':<60} {'N':>4} "
            f"{'avg(ms)':>9} {'p50(ms)':>9} {'p95(ms)':>9} "
            f"{'p99(ms)':>9} {'max(ms)':>9} "
            f"{'P95<500ms':>10}"
        )
        sep = "-" * len(header)
        lines = [
            "",
            "=" * len(header),
            "V11-12 性能基线测试报告  (P95 阈值: 500ms)",
            "=" * len(header),
            header,
            sep,
        ]
        all_pass = True
        for st in self.stats:
            s = st.summary()
            mark = "PASS" if s["pass_p95"] else "FAIL"
            if not s["pass_p95"]:
                all_pass = False
            lines.append(
                f"{s['name']:<60} {s['count']:>4} "
                f"{s['avg_ms']:>9.2f} {s['p50_ms']:>9.2f} "
                f"{s['p95_ms']:>9.2f} {s['p99_ms']:>9.2f} "
                f"{s['max_ms']:>9.2f} {mark:>10}"
            )
        lines.append(sep)
        lines.append(
            f"总结：{len(self.stats)} 个 API | "
            f"全部通过 P95<500ms：{'YES' if all_pass else 'NO'}"
        )
        return "\n".join(lines)

    def assert_all_pass(self) -> None:
        """Raise AssertionError with the formatted table if any API fails."""
        failures = [st.summary() for st in self.stats if not st.summary()["pass_p95"]]
        if failures:
            failed_names = ", ".join(f["name"] for f in failures)
            raise AssertionError(
                f"以下 API 的 P95 超过 {P95_THRESHOLD_MS}ms 阈值：{failed_names}\n"
                + self.format_table()
            )


async def measure(
    func: Callable,
    stats: PerfStats,
    iterations: int = 20,
) -> None:
    """Invoke ``await func()`` ``iterations`` times, recording elapsed ms.

    The function is expected to perform the actual HTTP call (or any async
    operation). Exceptions propagate to the caller; timing is only recorded
    for successful calls.
    """
    for _ in range(iterations):
        start = time.perf_counter()
        await func()
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        stats.record_ms(elapsed_ms)
