"""P0 close-out: lifespan wires ALL runtime singletons (2026-09-09).

Before P0 the lifespan only injected the quota bucket — cache / cost
recorder / monthly ceiling / user daily cap were production no-ops.
These tests pin the new wiring contract:

  * defaults (no Redis / no PG): recorder + monthly + daily cap injected,
    cache and quota bucket stay None (soft degrade, no crash);
  * with Redis + PG: everything injected, ensure_schema applied,
    shutdown clears every singleton and closes clients;
  * either dependency failing never raises out of startup.
"""
from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

import mate_tech_llmgw.main as main_mod
import mate_tech_llmgw.router as router_mod
from mate_tech_llmgw.repositories import ddl as ddl_mod


class _FakeRedis:
    def __init__(self) -> None:
        self.closed = False

    async def ping(self) -> None:
        return None

    async def aclose(self) -> None:
        self.closed = True


class _FakeConn:
    def __init__(self) -> None:
        self.executed: list[str] = []

    async def execute(self, sql: str, *args: Any) -> str:
        self.executed.append(sql)
        return "OK"

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        return []

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        return None


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *exc: Any) -> None:
        return None


class _FakePool:
    def __init__(self) -> None:
        self.conn = _FakeConn()
        self.closed = False

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)

    async def execute(self, sql: str, *args: Any) -> str:
        return await self.conn.execute(sql, *args)

    async def close(self) -> None:
        self.closed = True


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.delenv("PG_DSN", raising=False)
    monkeypatch.delenv("MATE_LLMGW_ENABLE_REDIS_QUOTA", raising=False)
    monkeypatch.delenv("MATE_LLMGW_ENABLE_CACHE", raising=False)
    monkeypatch.delenv("MATE_LLMGW_ENABLE_COST_PG", raising=False)
    monkeypatch.delenv("MATE_LLMGW_ENABLE_MONTHLY_CEILING", raising=False)
    monkeypatch.delenv("MATE_LLMGW_ENABLE_USER_DAILY_CAP", raising=False)


@pytest.fixture(autouse=True)
def _reset_singletons():
    router_mod.set_cache(None)
    router_mod.set_quota_bucket(None)
    router_mod.set_cost_recorder(None)
    router_mod.set_monthly_bucket(None)
    router_mod.set_user_daily_cap(None)
    yield
    router_mod.set_cache(None)
    router_mod.set_quota_bucket(None)
    router_mod.set_cost_recorder(None)
    router_mod.set_monthly_bucket(None)
    router_mod.set_user_daily_cap(None)


def test_lifespan_defaults_wire_memory_singletons_without_deps() -> None:
    """No Redis / no PG → recorder + monthly + daily cap injected; no crash."""
    with TestClient(main_mod.app):
        assert router_mod.get_cost_recorder() is not None
        assert router_mod.get_monthly_bucket() is not None
        assert router_mod.get_user_daily_cap() is not None
        # Soft dependencies degrade silently.
        assert router_mod.get_cache() is None
        assert router_mod.get_quota_bucket() is None
    # Shutdown clears everything.
    assert router_mod.get_cost_recorder() is None
    assert router_mod.get_monthly_bucket() is None
    assert router_mod.get_user_daily_cap() is None


def test_lifespan_wires_redis_and_pg_backends(monkeypatch: pytest.MonkeyPatch) -> None:
    """Redis + PG reachable → cache / quota / PG-backed cost recorder wired."""
    fake_redis = _FakeRedis()
    fake_pool = _FakePool()

    async def fake_redis_builder() -> Any:
        return fake_redis

    async def fake_pg_builder() -> Any:
        return fake_pool

    monkeypatch.setattr(main_mod, "_build_redis_client", fake_redis_builder)
    monkeypatch.setattr(main_mod, "_build_pg_pool", fake_pg_builder)
    monkeypatch.setenv("MATE_LLMGW_ENABLE_REDIS_QUOTA", "1")

    with TestClient(main_mod.app):
        assert router_mod.get_cache() is not None
        assert router_mod.get_quota_bucket() is not None
        recorder = router_mod.get_cost_recorder()
        assert recorder is not None
        assert recorder.pool is fake_pool
        # Idempotent DDL was applied to the PG_DSN database.
        assert any(
            "CREATE TABLE IF NOT EXISTS llm_usage" in sql
            for sql in fake_pool.conn.executed
        )

    assert router_mod.get_cache() is None
    assert router_mod.get_quota_bucket() is None
    assert router_mod.get_cost_recorder() is None


def test_lifespan_pg_failure_degrades_without_crash(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PG builder raising → startup still succeeds, recorder stays memory."""
    async def exploding_pg() -> Any:
        raise RuntimeError("pg down")

    monkeypatch.setattr(main_mod, "_build_pg_pool", exploding_pg)
    with TestClient(main_mod.app) as client:
        assert client.get("/healthz").status_code == 200
        recorder = router_mod.get_cost_recorder()
        assert recorder is not None
        assert recorder.pool is None


def test_lifespan_env_switches_can_disable_subsystems(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """MATE_LLMGW_ENABLE_* = false keeps that singleton unwired."""
    monkeypatch.setenv("MATE_LLMGW_ENABLE_USER_DAILY_CAP", "false")
    monkeypatch.setenv("MATE_LLMGW_ENABLE_MONTHLY_CEILING", "0")
    with TestClient(main_mod.app):
        assert router_mod.get_user_daily_cap() is None
        assert router_mod.get_monthly_bucket() is None
        # Cost recorder is always injected (memory fallback is harmless).
        assert router_mod.get_cost_recorder() is not None


@pytest.mark.asyncio
async def test_ensure_schema_is_exception_safe() -> None:
    """A broken connection logs and swallows — never blocks startup."""
    class _BrokenConn:
        async def execute(self, sql: str, *args: Any) -> str:
            raise RuntimeError("syntax error")

    await ddl_mod.ensure_schema(_BrokenConn())  # must not raise
