"""P3-W9: llmgw cache/quota/cost 接入 chat 主路径 + 管理 API 测试.

Tests:
  1. test_chat_returns_cached_response_on_second_call
  2. test_chat_records_cost_after_provider_call
  3. test_chat_rejects_when_quota_exceeded (429)
  4. test_cache_stats_endpoint
  5. test_cache_clear_endpoint
  6. test_quota_status_endpoint
  7. test_usage_endpoint
  8. test_cache_miss_when_different_tenant (tenant 隔离)
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mate_tech_llmgw.cache.llm_cache import LLMCache
from mate_tech_llmgw.chat import ChatMessage, ChatResponse
from mate_tech_llmgw.cost.recorder import CostRecorder
from mate_tech_llmgw.providers.openai import OpenAIChatProvider
from mate_tech_llmgw.quota.bucket import QuotaConfig, QuotaExceededError, RedisTokenBucket
from mate_tech_llmgw import router as router_mod


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_mock_cache(hit_payload: str | None = None) -> LLMCache:
    """Build an LLMCache backed by an AsyncMock Redis."""
    cache = LLMCache.__new__(LLMCache)
    cache._redis = AsyncMock()
    cache._ttl = 60
    cache._enabled = True
    cache._hits = 0
    cache._misses = 0
    cache._stored: dict[str, str] = {}

    async def fake_get(key: str):
        if key in cache._stored:
            cache._hits += 1
            return cache._stored[key]
        cache._misses += 1
        return None

    async def fake_setex(key: str, ttl: int, value: str):
        cache._stored[key] = value

    cache._redis.get = fake_get
    cache._redis.setex = fake_setex
    cache._redis.scan_iter = _make_scan_iter(cache._stored)
    cache._redis.delete = AsyncMock(side_effect=lambda k: cache._stored.pop(k, None))

    if hit_payload:
        # pre-seed one key — not needed for these tests
        pass

    return cache


def _make_scan_iter(stored: dict[str, str]):
    """Create an async iterator for scan_iter that matches stored keys."""

    async def _scan(*, match: str = "*", count: int = 100):
        import fnmatch

        for key in list(stored.keys()):
            if fnmatch.fnmatch(key, match):
                yield key

    return _scan


def _make_mock_quota_bucket(
    exceed: bool = False,
) -> RedisTokenBucket:
    """Build a RedisTokenBucket backed by an AsyncMock Redis."""
    cfg = QuotaConfig(rpm_limit=100, tpm_limit=100_000, window_sec=60)
    bucket = RedisTokenBucket.__new__(RedisTokenBucket)
    bucket._redis = AsyncMock()
    bucket._config = cfg

    if exceed:
        async def _acquire_exceed(*, tenant_id: str, estimated_tokens: int = 0):
            raise QuotaExceededError(f"req:{tenant_id}:0", retry_after=60)

        bucket.acquire = _acquire_exceed
    else:
        bucket.acquire = AsyncMock()

    async def _status(tenant_id: str):
        return {
            "tenant_id": tenant_id,
            "rpm_used": 5,
            "rpm_limit": cfg.rpm_limit,
            "tpm_used": 500,
            "tpm_limit": cfg.tpm_limit,
            "window_sec": cfg.window_sec,
        }

    bucket.status = _status
    return bucket


def _make_mock_cost_recorder() -> CostRecorder:
    """Build a CostRecorder that tracks records in memory (no PG)."""
    rec = CostRecorder.__new__(CostRecorder)
    rec._pool = None
    rec._dsn = "postgresql://test"
    rec._records = []
    # Bind the real record/summary methods
    rec.record = CostRecorder.record.__get__(rec, CostRecorder)
    rec.summary = CostRecorder.summary.__get__(rec, CostRecorder)
    return rec


@pytest.fixture(autouse=True)
def _reset_singletons():
    """Reset cache/quota/cost singletons before and after each test."""
    router_mod.set_cache(None)
    router_mod.set_quota_bucket(None)
    router_mod.set_cost_recorder(None)
    router_mod.reset_providers()
    yield
    router_mod.set_cache(None)
    router_mod.set_quota_bucket(None)
    router_mod.set_cost_recorder(None)
    router_mod.reset_providers()


def _stub_provider(resp_content: str = "hello") -> None:
    """Monkey-patch get_provider to return a stub that doesn't hit the network."""
    call_count = {"n": 0}

    class _StubProvider:
        model = "gpt-4o"

        async def chat(self, messages, *, temperature=1.0, max_tokens=None, tools=None, **kw):
            call_count["n"] += 1
            self._call_count = call_count
            return ChatResponse(
                content=resp_content,
                model="gpt-4o",
                finish_reason="stop",
                usage={"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            )

    stub = _StubProvider()
    router_mod._providers["openai"] = stub  # type: ignore[assignment]
    return stub


# ---------------------------------------------------------------------------
# Test 1: cache hit on second call skips provider
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_chat_returns_cached_response_on_second_call() -> None:
    """第二次调用应命中缓存,跳过 provider."""
    cache = _make_mock_cache()
    router_mod.set_cache(cache)
    stub = _stub_provider()

    msgs = [ChatMessage(role="user", content="hi")]

    # First call: miss → provider called → cache set
    resp1 = await router_mod.chat("gpt-4o", msgs, temperature=0.0, tenant_id="acme")
    assert resp1.content == "hello"
    assert stub._call_count["n"] == 1  # provider called once

    # Second call: hit → provider NOT called again
    resp2 = await router_mod.chat("gpt-4o", msgs, temperature=0.0, tenant_id="acme")
    assert resp2.content == "hello"
    assert stub._call_count["n"] == 1  # still 1 — served from cache


# ---------------------------------------------------------------------------
# Test 2: cost is recorded after provider call
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_chat_records_cost_after_provider_call() -> None:
    """provider 调用成功后应记录 cost."""
    recorder = _make_mock_cost_recorder()
    router_mod.set_cost_recorder(recorder)
    _stub_provider()

    msgs = [ChatMessage(role="user", content="hello world")]
    await router_mod.chat("gpt-4o", msgs, tenant_id="acme")

    summary = recorder.summary("acme")
    assert summary["total_tokens"] == 15
    assert summary["total_cost"] > 0
    assert "gpt-4o" in summary["by_model"]
    assert summary["by_model"]["gpt-4o"]["calls"] == 1


# ---------------------------------------------------------------------------
# Test 3: quota exceeded → 429
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_chat_rejects_when_quota_exceeded() -> None:
    """配额超限时返回 HTTPException 429."""
    from fastapi import HTTPException

    bucket = _make_mock_quota_bucket(exceed=True)
    router_mod.set_quota_bucket(bucket)

    msgs = [ChatMessage(role="user", content="hi")]
    with pytest.raises(HTTPException) as exc_info:
        await router_mod.chat("gpt-4o", msgs, tenant_id="acme")

    assert exc_info.value.status_code == 429
    assert "Quota exceeded" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Test 8: cache miss when different tenant (tenant isolation)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cache_miss_when_different_tenant() -> None:
    """不同租户的相同请求不应共享缓存."""
    cache = _make_mock_cache()
    router_mod.set_cache(cache)
    stub = _stub_provider()

    msgs = [ChatMessage(role="user", content="hi")]

    # Tenant A calls
    resp_a = await router_mod.chat("gpt-4o", msgs, temperature=0.0, tenant_id="tenantA")
    assert resp_a.content == "hello"
    assert stub._call_count["n"] == 1

    # Tenant B calls same prompt → should NOT hit tenant A's cache
    resp_b = await router_mod.chat("gpt-4o", msgs, temperature=0.0, tenant_id="tenantB")
    assert resp_b.content == "hello"
    assert stub._call_count["n"] == 2  # provider called again for tenant B

    # Tenant A calls again → should hit cache
    resp_a2 = await router_mod.chat("gpt-4o", msgs, temperature=0.0, tenant_id="tenantA")
    assert stub._call_count["n"] == 2  # no new provider call for tenant A


# ---------------------------------------------------------------------------
# Management API endpoint tests (4-7) — use TestClient
# ---------------------------------------------------------------------------
@pytest.fixture
def management_client():
    """Build a minimal FastAPI app with only the llmgw router (no auth)."""
    from mate_tech_llmgw.api.routes import router as llm_router

    app = FastAPI(title="llmgw-mgmt-test")
    app.include_router(llm_router)
    return TestClient(app)


def test_cache_stats_endpoint(management_client: TestClient) -> None:
    """GET /cache/stats 返回命中率统计."""
    cache = _make_mock_cache()
    # Simulate 3 hits + 1 miss
    cache._hits = 3
    cache._misses = 1
    router_mod.set_cache(cache)

    r = management_client.get("/api/v1/llmgw/cache/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["hits"] == 3
    assert body["misses"] == 1
    assert body["hit_rate"] == 0.75
    assert body["enabled"] is True


def test_cache_stats_endpoint_no_cache(management_client: TestClient) -> None:
    """GET /cache/stats 无 cache 实例时返回默认值."""
    r = management_client.get("/api/v1/llmgw/cache/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is False
    assert body["hits"] == 0


def test_cache_clear_endpoint(management_client: TestClient) -> None:
    """DELETE /cache/{tenant_id} 清除租户缓存."""
    cache = _make_mock_cache()
    # Pre-seed some keys
    cache._stored["llmgw:cache:acme:abc"] = "{}"
    cache._stored["llmgw:cache:acme:def"] = "{}"
    cache._stored["llmgw:cache:other:xyz"] = "{}"
    router_mod.set_cache(cache)

    r = management_client.delete("/api/v1/llmgw/cache/acme")
    assert r.status_code == 200
    body = r.json()
    assert body["cleared"] == 2
    assert body["tenant_id"] == "acme"
    # Other tenant's cache preserved
    assert "llmgw:cache:other:xyz" in cache._stored


def test_quota_status_endpoint(management_client: TestClient) -> None:
    """GET /quota/{tenant_id} 返回配额状态."""
    bucket = _make_mock_quota_bucket()
    router_mod.set_quota_bucket(bucket)

    r = management_client.get("/api/v1/llmgw/quota/acme")
    assert r.status_code == 200
    body = r.json()
    assert body["tenant_id"] == "acme"
    assert body["rpm_used"] == 5
    assert body["rpm_limit"] == 100
    assert body["tpm_used"] == 500
    assert body["tpm_limit"] == 100_000


def test_quota_status_endpoint_no_bucket(management_client: TestClient) -> None:
    """GET /quota/{tenant_id} 无 bucket 时返回默认值."""
    r = management_client.get("/api/v1/llmgw/quota/acme")
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is False


def test_usage_endpoint(management_client: TestClient) -> None:
    """GET /usage/{tenant_id} 返回成本用量摘要."""
    recorder = _make_mock_cost_recorder()
    router_mod.set_cost_recorder(recorder)

    # Simulate recording some usage
    import asyncio

    asyncio.run(
        recorder.record(
            model="gpt-4o",
            tenant_id="acme",
            usage={"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
        )
    )

    r = management_client.get("/api/v1/llmgw/usage/acme")
    assert r.status_code == 200
    body = r.json()
    assert body["tenant_id"] == "acme"
    assert body["total_tokens"] == 150
    assert body["total_cost"] > 0
    assert "gpt-4o" in body["by_model"]


def test_usage_endpoint_no_recorder(management_client: TestClient) -> None:
    """GET /usage/{tenant_id} 无 recorder 时返回默认值."""
    r = management_client.get("/api/v1/llmgw/usage/acme")
    assert r.status_code == 200
    body = r.json()
    assert body["total_tokens"] == 0
    assert body["total_cost"] == 0.0
