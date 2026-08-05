"""Quota tests (ST-5.5.4.3)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_tech_llmgw.quota.bucket import QuotaConfig, QuotaExceededError, RedisTokenBucket
from mate_tech_llmgw.quota.guard import with_quota


def _make_redis_mock(execute_return):
    """Build a mock that responds to ``redis.pipeline()``.

    redis-py's ``pipeline()`` is a *synchronous* method that returns
    a Pipeline object; only ``execute()`` is awaitable. Using a
    bare AsyncMock would make ``pipeline()`` itself a coroutine,
    breaking the production code path. So we set ``pipeline`` to a
    sync MagicMock and only ``execute`` to AsyncMock.

    See: redis.asyncio.client.Redis.pipeline signature is sync;
    only RedisPipeline.execute is async.
    """
    mock_redis = AsyncMock()
    pipe = MagicMock()
    # incr / expire are sync calls on the Pipeline object.
    pipe.incr.return_value = None
    pipe.expire.return_value = None
    pipe.execute = AsyncMock(return_value=execute_return)
    mock_redis.pipeline = MagicMock(return_value=pipe)
    return mock_redis


@pytest.mark.asyncio
async def test_quota_rpm_exceeded() -> None:
    """RPM 超限 -> QuotaExceededError."""
    cfg = QuotaConfig(rpm_limit=2, tpm_limit=100_000, window_sec=60)
    mock_redis = _make_redis_mock(
        execute_return=[3, True, 100, True]
    )
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)
    with pytest.raises(QuotaExceededError, match="Quota exceeded"):
        await bucket.acquire(tenant_id="acme", estimated_tokens=100)


@pytest.mark.asyncio
async def test_quota_tpm_exceeded() -> None:
    """TPM 超限 -> QuotaExceededError."""
    cfg = QuotaConfig(rpm_limit=100, tpm_limit=1000, window_sec=60)
    mock_redis = _make_redis_mock(
        execute_return=[1, True, 1500, True]
    )
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)
    with pytest.raises(QuotaExceededError):
        await bucket.acquire(tenant_id="acme", estimated_tokens=1500)


@pytest.mark.asyncio
async def test_quota_within_limit() -> None:
    """未超限 -> 成功."""
    cfg = QuotaConfig(rpm_limit=10, tpm_limit=10_000, window_sec=60)
    mock_redis = _make_redis_mock(
        execute_return=[1, True, 100, True]
    )
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)
    await bucket.acquire(tenant_id="acme", estimated_tokens=100)


@pytest.mark.asyncio
async def test_with_quota_decorator_passes() -> None:
    """ST-5.5.4.2: 装饰器正常路径."""
    cfg = QuotaConfig(rpm_limit=10, tpm_limit=10_000)
    mock_redis = _make_redis_mock(
        execute_return=[1, True, 100, True]
    )
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)

    @with_quota(bucket=bucket, config=cfg, queue_timeout=0.1, poll_interval=0.05)
    async def fake_chat(tenant_id: str = "default") -> str:
        return "ok"

    assert await fake_chat(tenant_id="acme") == "ok"