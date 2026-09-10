"""P0 close-out: /usage reads from PG when a pool is attached (2026-09-09).

CostRecorder.summary() is now async and prefers a SQL aggregate over
llm_usage; the memory deque path remains as fallback with the same
output shape. Also pins the bounded memory deque (maxlen=10_000).
"""

from __future__ import annotations

import pytest

from mate_tech_llmgw.cost.recorder import CostRecorder, UsageRecord


class _FakeAcquire:
    def __init__(self, conn) -> None:
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc) -> None:
        return None


class _FakePool:
    """Minimal asyncpg.Pool double: captures fetch args."""

    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.queries: list[tuple[str, tuple]] = []

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self)

    async def fetch(self, sql: str, *args):
        self.queries.append((sql, args))
        return self.rows


@pytest.mark.asyncio
async def test_summary_prefers_pg_aggregate() -> None:
    pool = _FakePool(
        [
            {"model": "gpt-4o", "tokens": 150, "cost": 0.0015, "calls": 2},
            {"model": "deepseek-chat", "tokens": 500, "cost": 0.00021, "calls": 1},
        ]
    )
    recorder = CostRecorder(pool=pool)
    summary = await recorder.summary("acme")

    assert summary["tenant_id"] == "acme"
    assert summary["total_tokens"] == 650
    assert summary["by_model"]["gpt-4o"]["calls"] == 2
    assert summary["by_model"]["deepseek-chat"]["tokens"] == 500
    # Query filters by tenant and time window.
    sql, args = pool.queries[0]
    assert "tenant_id = $1" in sql
    assert args[0] == "acme"


@pytest.mark.asyncio
async def test_summary_falls_back_to_memory_when_pg_fails() -> None:
    class _BrokenPool:
        def acquire(self):
            raise RuntimeError("connection refused")

    recorder = CostRecorder(pool=_BrokenPool())
    # Seed the memory deque via the normal record path (no pool → memory only
    # would be cleaner, but here pool exists and explodes → fallback branch).
    recorder._pool = None
    await recorder.record(
        model="gpt-4o",
        tenant_id="acme",
        usage={"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
    )
    recorder._pool = _BrokenPool()
    summary = await recorder.summary("acme")

    assert summary["total_tokens"] == 15
    assert summary["by_model"]["gpt-4o"]["calls"] == 1


def test_memory_records_are_bounded() -> None:
    recorder = CostRecorder(pool=None)
    assert recorder._records.maxlen == 10_000


def test_record_without_pool_appends_memory() -> None:
    import asyncio

    recorder = CostRecorder(pool=None)
    rec = asyncio.run(
        recorder.record(
            model="gpt-4o",
            tenant_id="acme",
            usage={"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            user_id="u1",
        )
    )
    assert isinstance(rec, UsageRecord)
    assert rec.user_id == "u1"
    assert len(recorder._records) == 1
