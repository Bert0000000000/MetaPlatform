"""Quota tests (ST-5.5.4.3)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from mate_tech_llmgw.quota.bucket import QuotaConfig, QuotaExceeded, RedisTokenBucket
from mate_tech_llmgw.quota.guard import with_quota


@pytest.mark.asyncio
async def test_quota_rpm_exceeded() -> None:
    """RPM 超限 -> QuotaExceeded."""
    cfg = QuotaConfig(rpm_limit=2, tpm_limit=100_000, window_sec=60)
    mock_redis = AsyncMock()
    mock_redis.pipeline.return_value.execute = AsyncMock(
        return_value=[(3, 60, 100, 60), (3, 60, 100, 60)]
    )
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)
    with pytest.raises(QuotaExceeded, match="Quota exceeded"):
        await bucket.acquire(tenant_id="acme", estimated_tokens=100)


@pytest.mark.asyncio
async def test_quota_tpm_exceeded() -> None:
    """TPM 超限 -> QuotaExceeded."""
    cfg = QuotaConfig(rpm_limit=100, tpm_limit=1000, window_sec=60)
    mock_redis = AsyncMock()
    mock_redis.pipeline.return_value.execute = AsyncMock(
        return_value=[(1, 60, 1500, 60), (1, 60, 1500, 60)]
    )
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)
    with pytest.raises(QuotaExceeded):
        await bucket.acquire(tenant_id="acme", estimated_tokens=1500)


@pytest.mark.asyncio
async def test_quota_within_limit() -> None:
    """未超限 -> 成功."""
    cfg = QuotaConfig(rpm_limit=10, tpm_limit=10_000, window_sec=60)
    mock_redis = AsyncMock()
    mock_redis.pipeline.return_value.execute = AsyncMock(
        return_value=[(1, 60, 100, 60), (1, 60, 100, 60)]
    )
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)
    await bucket.acquire(tenant_id="acme", estimated_tokens=100)


@pytest.mark.asyncio
async def test_with_quota_decorator_passes() -> None:
    """ST-5.5.4.2: 装饰器正常路径."""
    cfg = QuotaConfig(rpm_limit=10, tpm_limit=10_000)
    mock_redis = AsyncMock()
    mock_redis.pipeline.return_value.execute = AsyncMock(
        return_value=[(1, 60, 100, 60), (1, 60, 100, 60)]
    )
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)

    @with_quota(bucket=bucket, config=cfg, queue_timeout=0.1, poll_interval=0.05)
    async def fake_chat(tenant_id: str = "default") -> str:
        return "ok"

    assert await fake_chat(tenant_id="acme") == "ok"