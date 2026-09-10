"""P1: three-layer usage store + budget semantics (2026-09-09).

Layers: llm_usage detail → llm_usage_daily rollup → llmgw_api_keys.spend.
Budget checks read ONLY the daily rollup (window_spend).
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from mate_tech_llmgw.cost.budget import BudgetExceededError, TenantBudgetGuard
from mate_tech_llmgw.cost.recorder import UsageRecord, estimate_cost
from mate_tech_llmgw.cost.usage_store import UsageStore


class _FakeAcquire:
    def __init__(self, conn) -> None:
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc) -> None:
        return None


class _ScriptedPool:
    """Replays canned rows per SQL keyword; records executed statements."""

    def __init__(self) -> None:
        self.conn = _ScriptedConn()
        self.statements: list[tuple[str, tuple]] = []

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)

    async def fetchrow(self, sql: str, *args):
        self.statements.append((sql, args))
        return self.conn.fetchrow(sql, *args)

    async def fetch(self, sql: str, *args):
        self.statements.append((sql, args))
        return self.conn.fetch(sql, *args)


class _ScriptedConn:
    def __init__(self) -> None:
        self.rows_by_keyword: dict[str, list[dict] | dict | None] = {}
        self.executed: list[tuple[str, tuple]] = []
        self.fetched: list[str] = []
        self.tx_depth = 0

    def on(self, keyword: str, rows) -> None:
        self.rows_by_keyword[keyword] = rows

    async def execute(self, sql: str, *args):
        self.executed.append((sql, args))
        return "OK"

    async def fetch(self, sql: str, *args):
        self.fetched.append(sql)
        for kw, rows in self.rows_by_keyword.items():
            if kw in sql:
                return rows if isinstance(rows, list) else []
        return []

    async def fetchrow(self, sql: str, *args):
        self.fetched.append(sql)
        for kw, row in self.rows_by_keyword.items():
            if kw in sql:
                return row
        return None

    def transaction(self):
        outer = self

        class _Tx:
            async def __aenter__(self):
                outer.tx_depth += 1
                return self

            async def __aexit__(self, *exc):
                outer.tx_depth -= 1
                return None

        return _Tx()


def _usage_record(**overrides) -> UsageRecord:
    defaults = dict(
        model="doubao-1.5-pro-32k",
        tenant_id="acme",
        user_id="u1",
        prompt_tokens=100,
        completion_tokens=50,
        cost_usd=estimate_cost("doubao-1.5-pro-32k", 100, 50),
        ts=datetime.now(UTC),
    )
    defaults.update(overrides)
    return UsageRecord(**defaults)


@pytest.mark.asyncio
async def test_record_usage_writes_three_layers_in_one_tx() -> None:
    pool = _ScriptedPool()
    store = UsageStore(pool)

    await store.record_usage(_usage_record(api_key_id="key-1", provider="doubao"))

    sqls = [s for s, _ in pool.conn.executed]
    assert any("INSERT INTO llm_usage\n" in s or "INSERT INTO llm_usage " in s for s in sqls)
    assert any("INSERT INTO llm_usage_daily" in s for s in sqls)
    assert any("ON CONFLICT (tenant_id, day, api_key_id, model)" in s for s in sqls)
    assert any("UPDATE llmgw_api_keys" in s for s in sqls)
    # The three writes were wrapped in a transaction.
    assert pool.conn.tx_depth == 0  # exited cleanly


@pytest.mark.asyncio
async def test_record_usage_without_key_skips_layer3() -> None:
    pool = _ScriptedPool()
    store = UsageStore(pool)
    await store.record_usage(_usage_record(api_key_id=""))
    assert not any("UPDATE llmgw_api_keys" in s for s, _ in pool.conn.executed)


@pytest.mark.asyncio
async def test_window_spend_reads_daily_rollup_only() -> None:
    pool = _ScriptedPool()
    pool.conn.on("llm_usage_daily", {"s": 12.5})
    store = UsageStore(pool)

    spend = await store.window_spend(tenant_id="acme", since=datetime.now(UTC))
    assert spend == 12.5
    # Aggregate table only — never the detail table.
    assert pool.conn.fetched, "window_spend issued no query"
    sql = pool.conn.fetched[0]
    assert "llm_usage_daily" in sql
    assert "FROM llm_usage " not in sql.replace("llm_usage_daily", "")


@pytest.mark.asyncio
async def test_budget_guard_no_config_is_noop() -> None:
    pool = _ScriptedPool()
    pool.conn.on("llmgw_tenant_config", None)  # no row
    guard = TenantBudgetGuard(pool)
    await guard.check("acme")  # must not raise


@pytest.mark.asyncio
async def test_budget_guard_max_blocks_with_429_error() -> None:
    pool = _ScriptedPool()
    pool.conn.on(
        "llmgw_tenant_config",
        {"soft_budget_usd": 5.0, "max_budget_usd": 10.0},
    )
    pool.conn.on("llm_usage_daily", {"s": 9.99})
    guard = TenantBudgetGuard(pool)

    with pytest.raises(BudgetExceededError) as exc:
        await guard.check("acme", estimated_cost_usd=0.5)  # 9.99 + 0.5 > 10
    assert exc.value.max_usd == 10.0


@pytest.mark.asyncio
async def test_budget_guard_soft_only_warns_never_blocks() -> None:
    pool = _ScriptedPool()
    pool.conn.on(
        "llmgw_tenant_config",
        {"soft_budget_usd": 5.0, "max_budget_usd": None},
    )
    pool.conn.on("llm_usage_daily", {"s": 7.0})  # past soft, no max
    guard = TenantBudgetGuard(pool)

    await guard.check("acme")  # must NOT raise
    await guard.check("acme")  # second crossing same day: alert deduped


@pytest.mark.asyncio
async def test_budget_guard_pg_failure_degrades_silently() -> None:
    class _BrokenPool:
        def acquire(self):
            raise RuntimeError("pg down")

    guard = TenantBudgetGuard(_BrokenPool())
    await guard.check("acme")  # must not raise
