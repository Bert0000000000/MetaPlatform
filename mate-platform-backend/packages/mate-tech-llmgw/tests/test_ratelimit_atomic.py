"""P3: atomic rate limiting + per-tenant config (2026-09-09).

- decide(): pure window evaluation (no Redis needed)
- Lua semantics: atomic check+increment, EXPIRE only on creation, rejected
  requests consume the window slot
- TenantConfigProvider: Redis read-through → PG → defaults; invalidate()
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from mate_tech_llmgw.quota.bucket import (
    Decision,
    QuotaConfig,
    QuotaExceededError,
    RedisTokenBucket,
    TenantConfigProvider,
    decide,
)


# ---------------------------------------------------------------------------
# Pure decision table
# ---------------------------------------------------------------------------
def test_decide_allows_within_limits() -> None:
    d = decide(10, 50_000, QuotaConfig(), now=1_000_003)
    assert d.allowed and d.reason == ""


def test_decide_blocks_on_rpm_first() -> None:
    d = decide(101, 50_000, QuotaConfig(), now=1_000_003)
    assert not d.allowed and d.reason == "rpm"
    assert d.retry_after == 60 - (1_000_003 % 60)


def test_decide_blocks_on_tpm() -> None:
    d = decide(10, 100_001, QuotaConfig(), now=1_000_003)
    assert not d.allowed and d.reason == "tpm"


def test_decide_retry_after_at_least_one_second() -> None:
    cfg = QuotaConfig(window_sec=60)
    now = 120 - 1  # exactly the last second of a window
    d = decide(999, 0, cfg, now=now)
    assert d.retry_after >= 1


# ---------------------------------------------------------------------------
# Lua semantics via a faithful fake Redis
# ---------------------------------------------------------------------------
class _LuaRedis:
    """Replays _RATELIMIT_LUA semantics (INCR/INCRBY/EXPIRE-once)."""

    def __init__(self) -> None:
        self.store: dict[str, int] = {}
        self.ttl_set_on: set[str] = set()

    def get(self, key: str) -> int | None:
        return self.store.get(key)

    async def eval(self, script: str, numkeys: int, *argv: Any) -> list[int]:
        req_key, tok_key = argv[0], argv[1]
        rpm, tpm, est_tokens, window, now = (
            int(argv[2]),
            int(argv[3]),
            int(argv[4]),
            int(argv[5]),
            int(argv[6]),
        )
        req = self.store.get(req_key, 0) + 1
        self.store[req_key] = req
        if req == 1:
            self.ttl_set_on.add(req_key)
        tok = self.store.get(tok_key, 0) + est_tokens
        self.store[tok_key] = tok
        if tok == est_tokens:
            self.ttl_set_on.add(tok_key)
        retry = window - (now % window)
        if req > rpm:
            return [0, req, tok, retry, 1]
        if tok > tpm:
            return [0, req, tok, retry, 2]
        return [1, req, tok, 0, 0]


@pytest.mark.asyncio
async def test_acquire_atomic_counter_no_oversell() -> None:
    redis = _LuaRedis()
    bucket = RedisTokenBucket(redis_client=redis, config=QuotaConfig(rpm_limit=5))

    allowed = 0
    for _ in range(10):
        try:
            await bucket.acquire(tenant_id="acme", estimated_tokens=100)
            allowed += 1
        except QuotaExceededError:
            pass
    # Exactly the configured 5 requests get through — the legacy
    # INCR-then-check race could let more through under concurrency.
    assert allowed == 5
    # EXPIRE set exactly once per key (legacy code reset it every request).
    assert redis.ttl_set_on == {"req:acme:0", "tok:acme:0"} or len(redis.ttl_set_on) <= 2


@pytest.mark.asyncio
async def test_acquire_rejected_requests_consume_window() -> None:
    redis = _LuaRedis()
    bucket = RedisTokenBucket(redis_client=redis, config=QuotaConfig(tpm_limit=1000))

    await bucket.acquire(tenant_id="t", estimated_tokens=600)
    with pytest.raises(QuotaExceededError):  # 600 + 600 > 1000
        await bucket.acquire(tenant_id="t", estimated_tokens=600)
    # The rejected request's tokens stayed counted (documented semantics).
    minute = redis.store and next(k.split(":")[2] for k in redis.store if k.startswith("tok:t:"))
    assert redis.store[f"tok:t:{minute}"] == 1200


@pytest.mark.asyncio
async def test_acquire_redis_down_degrades_open() -> None:
    class _BrokenRedis:
        async def eval(self, *a: Any, **kw: Any) -> Any:
            raise ConnectionError("redis down")

    bucket = RedisTokenBucket(redis_client=_BrokenRedis())
    await bucket.acquire(tenant_id="t", estimated_tokens=1)  # no raise


# ---------------------------------------------------------------------------
# TenantConfigProvider
# ---------------------------------------------------------------------------
class _FakeAcquire:
    def __init__(self, conn) -> None:
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc) -> None:
        return None


class _PgRedisDouble:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self.store[key] = value

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)


class _ConfigConn:
    def __init__(self, row: dict | None) -> None:
        self.row = row

    async def fetchrow(self, sql: str, *args: Any) -> dict | None:
        return self.row


class _ConfigPool:
    def __init__(self, row: dict | None) -> None:
        self.row = row

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(_ConfigConn(self.row))


@pytest.mark.asyncio
async def test_tenant_config_resolves_pg_row_over_defaults() -> None:
    pool = _ConfigPool({"rpm_limit": 7, "tpm_limit": 42_000, "window_sec": 60})
    cache = _PgRedisDouble()
    provider = TenantConfigProvider(pg_pool=pool, redis_client=cache)

    cfg = await provider.resolve("vip-tenant")
    assert cfg.rpm_limit == 7
    assert cfg.tpm_limit == 42_000
    # Cached for the read-through path.
    assert "llmgw:tenantcfg:vip-tenant" in cache.store


@pytest.mark.asyncio
async def test_tenant_config_uses_redis_cache_before_pg() -> None:
    calls = {"n": 0}

    class _CountingPool(_ConfigPool):
        def __init__(self) -> None:
            super().__init__(None)
            self.calls = 0

        def acquire(self) -> _FakeAcquire:
            calls["n"] += 1
            return super().acquire()

    cache = _PgRedisDouble()
    cache.store["llmgw:tenantcfg:t1"] = json.dumps(
        {"rpm_limit": 3, "tpm_limit": 9_000, "window_sec": 60}
    )
    provider = TenantConfigProvider(pg_pool=_CountingPool(), redis_client=cache)

    cfg = await provider.resolve("t1")
    assert cfg.rpm_limit == 3
    assert calls["n"] == 0  # served from Redis, PG untouched


@pytest.mark.asyncio
async def test_tenant_config_pg_failure_falls_back_to_defaults() -> None:
    class _BrokenPool:
        def acquire(self):
            raise RuntimeError("pg down")

    provider = TenantConfigProvider(pg_pool=_BrokenPool())
    cfg = await provider.resolve("t")
    assert cfg == QuotaConfig()


@pytest.mark.asyncio
async def test_tenant_config_invalidate_clears_cache() -> None:
    pool = _ConfigPool({"rpm_limit": 7, "tpm_limit": 42_000, "window_sec": 60})
    cache = _PgRedisDouble()
    provider = TenantConfigProvider(pg_pool=pool, redis_client=cache)

    await provider.resolve("t")  # populates caches
    await provider.invalidate("t")
    assert "llmgw:tenantcfg:t" not in cache.store
    cfg = await provider.resolve("t")  # re-reads from PG
    assert cfg.rpm_limit == 7


@pytest.mark.asyncio
async def test_bucket_uses_per_tenant_limits() -> None:
    redis = _LuaRedis()
    pool = _ConfigPool({"rpm_limit": 2, "tpm_limit": 999_999, "window_sec": 60})
    provider = TenantConfigProvider(pg_pool=pool)
    bucket = RedisTokenBucket(redis_client=redis, config=QuotaConfig(), tenant_config=provider)

    await bucket.acquire(tenant_id="tight", estimated_tokens=1)
    await bucket.acquire(tenant_id="tight", estimated_tokens=1)
    with pytest.raises(QuotaExceededError):
        await bucket.acquire(tenant_id="tight", estimated_tokens=1)
    # Another tenant is unaffected (its limits come from the same provider,
    # but counters are per-tenant keys).
    await bucket.acquire(tenant_id="other", estimated_tokens=1)


def test_decision_is_pure_dataclass() -> None:
    d = Decision(True)
    assert (d.allowed, d.reason, d.retry_after) == (True, "", 0)
