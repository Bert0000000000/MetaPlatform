"""P2: cooldown manager + resilient call chain (2026-09-09).

LiteLLM deployment_callback_on_failure semantics: failures/min window →
allowed_fails → Redis cooldown; duration priority config > Retry-After >
default; success resets; Redis down = no-op.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from mate_tech_llmgw.resilience import set_cooldown
from mate_tech_llmgw.resilience.call import call_with_resilience, load_fallback_chain
from mate_tech_llmgw.resilience.cooldown import CooldownManager
from mate_tech_llmgw.resilience.errors import (
    ProviderCallError,
    classify_provider_error,
)


class _FakeRedis:
    """Minimal Redis double backing the cooldown Lua script semantics."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.ttls: dict[str, int] = {}

    def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def eval(self, script: str, numkeys: int, *args: Any) -> list[int]:
        # Replay _RECORD_FAILURE_LUA against the plain store.

        fails_key, ts_key, until_key = args[:3]
        now, window, allowed, cooldown_sec = (
            float(args[3]),
            float(args[4]),
            int(args[5]),
            float(args[6]),
        )
        ts = float(self.store.get(ts_key, "0"))
        if now - ts > window:
            self.store[fails_key] = "0"
            self.store[ts_key] = str(now)
        fails = int(self.store.get(fails_key, "0")) + 1
        self.store[fails_key] = str(fails)
        armed = 0
        if fails > allowed and until_key not in self.store:
            self.store[until_key] = str(now + cooldown_sec)
            self.ttls[until_key] = int(cooldown_sec)
            armed = 1
        return [fails, armed]

    async def delete(self, *keys: str) -> int:
        removed = 0
        for k in keys:
            if k in self.store:
                del self.store[k]
                removed += 1
        return removed


@pytest.fixture(autouse=True)
def _reset_cooldown():
    set_cooldown(None)
    yield
    set_cooldown(None)


@pytest.mark.asyncio
async def test_cooldown_arms_after_allowed_fails() -> None:
    redis = _FakeRedis()
    manager = CooldownManager(redis, allowed_fails=2, default_cooldown_sec=60)

    await manager.record_failure("doubao")
    await manager.record_failure("doubao")
    assert manager.check("doubao") is None  # 2 fails ≤ allowed_fails=2

    await manager.record_failure("doubao")  # 3rd failure within the minute
    remaining = manager.check("doubao")
    assert remaining is not None and 0 < remaining <= 60


@pytest.mark.asyncio
async def test_cooldown_success_resets_window() -> None:
    redis = _FakeRedis()
    manager = CooldownManager(redis, allowed_fails=1)
    await manager.record_failure("openai")
    assert manager.check("openai") is None
    await manager.record_success("openai")
    await manager.record_failure("openai")  # counter restarted — still allowed
    assert manager.check("openai") is None


@pytest.mark.asyncio
async def test_cooldown_duration_priority_retry_after_over_default() -> None:
    redis = _FakeRedis()
    manager = CooldownManager(redis, allowed_fails=0, default_cooldown_sec=60)
    await manager.record_failure("qwen", retry_after_hint=7)
    remaining = manager.check("qwen")
    assert remaining is not None and remaining <= 7.0


def test_provider_call_error_classification() -> None:
    retryable_5xx = ProviderCallError("boom", provider="openai", status_code=503)
    assert retryable_5xx.retryable and not retryable_5xx.non_retryable_client_error

    rate_limited = ProviderCallError("slow down", provider="openai", status_code=429)
    assert rate_limited.retryable

    bad_request = ProviderCallError("bad", provider="openai", status_code=400)
    assert not bad_request.retryable
    assert bad_request.non_retryable_client_error

    network = ProviderCallError("conn", provider="openai")  # no status
    assert network.retryable

    # Subclasses RuntimeError → legacy `except RuntimeError → 503` intact.
    assert isinstance(retryable_5xx, RuntimeError)


def test_classify_from_httpx_status_error() -> None:
    import httpx

    request = httpx.Request("POST", "https://api.test/v1/chat")
    response = httpx.Response(429, request=request, headers={"Retry-After": "12"})
    err = classify_provider_error(
        "openai", httpx.HTTPStatusError("429", request=request, response=response)
    )
    assert err.status_code == 429
    assert err.retryable
    assert err.retry_after == 12


@pytest.mark.asyncio
async def test_call_with_resilience_skips_cooldown_candidate() -> None:
    redis = _FakeRedis()
    manager = CooldownManager(redis, allowed_fails=0)
    await manager.record_failure("openai")  # immediately cooling

    calls: list[str] = []

    async def cooling_call() -> str:
        calls.append("openai")
        return "should-not-happen"

    async def healthy_call() -> str:
        calls.append("qwen")
        return "ok"

    set_cooldown(manager)
    result = await call_with_resilience(
        [
            ("openai", cooling_call),
            ("qwen", healthy_call),
        ]
    )
    assert result == "ok"
    assert calls == ["qwen"]


@pytest.mark.asyncio
async def test_call_with_resilience_4xx_surfaces_no_fallback() -> None:
    calls: list[str] = []

    async def bad_request() -> str:
        calls.append("openai")
        raise ProviderCallError("invalid request", provider="openai", status_code=400)

    async def fallback() -> str:
        calls.append("qwen")
        return "unused"

    with pytest.raises(HTTPException) as exc_info:
        await call_with_resilience([("openai", bad_request), ("qwen", fallback)])
    assert exc_info.value.status_code == 400
    assert calls == ["openai"]  # fallback never consumed


@pytest.mark.asyncio
async def test_call_with_resilience_5xx_falls_through() -> None:
    attempts: list[str] = []

    async def failing() -> str:
        attempts.append("openai")
        raise ProviderCallError("upstream down", provider="openai", status_code=502)

    async def healthy() -> str:
        attempts.append("qwen")
        return "ok"

    # max_attempts=1 → single shot per candidate, deterministic and fast.
    result = await call_with_resilience([("openai", failing), ("qwen", healthy)], max_attempts=1)
    assert result == "ok"
    assert attempts == ["openai", "qwen"]


@pytest.mark.asyncio
async def test_call_with_resilience_retries_only_retryable() -> None:
    attempts: list[int] = []

    async def flaky() -> str:
        attempts.append(1)
        if len(attempts) < 2:
            raise ProviderCallError("503", provider="openai", status_code=503)
        return "recovered"

    result = await call_with_resilience([("openai", flaky)], max_attempts=2, initial_wait=0.01)
    assert result == "recovered"
    assert len(attempts) == 2

    # Non-retryable 4xx: single attempt, surfaced.
    attempts.clear()

    async def bad() -> str:
        attempts.append(1)
        raise ProviderCallError("401", provider="openai", status_code=401)

    with pytest.raises(HTTPException) as exc_info:
        await call_with_resilience([("openai", bad)], max_attempts=3, initial_wait=0.01)
    assert exc_info.value.status_code == 401
    assert len(attempts) == 1


@pytest.mark.asyncio
async def test_call_with_resilience_value_error_passthrough() -> None:
    """Programming/input errors must surface unchanged (route maps → 400)."""

    async def broken() -> str:
        raise ValueError("unknown model")

    with pytest.raises(ValueError):
        await call_with_resilience([("openai", broken)], max_attempts=3)


@pytest.mark.asyncio
async def test_call_with_resilience_chain_exhausted() -> None:
    async def failing() -> str:
        raise ProviderCallError("down", provider="openai", status_code=500)

    with pytest.raises(RuntimeError, match="all provider candidates failed"):
        await call_with_resilience([("openai", failing), ("qwen", failing)], max_attempts=1)


def test_load_fallback_chain_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLMGW_FALLBACKS", raising=False)
    assert load_fallback_chain("gpt-4o") == ()

    monkeypatch.setenv("LLMGW_FALLBACKS", '{"gpt-4o": ["gpt-4o-mini", "qwen-plus"]}')
    assert load_fallback_chain("gpt-4o") == ("gpt-4o-mini", "qwen-plus")
    assert load_fallback_chain("other") == ()

    monkeypatch.setenv("LLMGW_FALLBACKS", "not-json")
    assert load_fallback_chain("gpt-4o") == ()


@pytest.mark.asyncio
async def test_cooldown_redis_down_is_noop() -> None:
    class _BrokenRedis:
        def get(self, key: str) -> str | None:
            raise ConnectionError("redis down")

        async def eval(self, *a: Any, **kw: Any) -> Any:
            raise ConnectionError("redis down")

        async def delete(self, *a: str) -> int:
            raise ConnectionError("redis down")

    manager = CooldownManager(_BrokenRedis())
    assert manager.check("openai") is None
    await manager.record_failure("openai")  # no raise
    await manager.record_success("openai")  # no raise
