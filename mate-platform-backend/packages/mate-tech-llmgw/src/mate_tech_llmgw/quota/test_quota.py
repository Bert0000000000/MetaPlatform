"""Quota tests (ST-5.5.4.3)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_tech_llmgw.quota.bucket import QuotaConfig, QuotaExceededError, RedisTokenBucket
from mate_tech_llmgw.quota.guard import with_quota


def _make_redis_mock(execute_return):
    """Build a mock for the legacy pipeline API AND the P3 Lua path.

    P3 switched acquire() from INCR+EXPIRE pipelines to a single atomic
    ``eval`` (script returns [allowed, req, tok, retry_after, reason]).
    The pipeline mock is kept for guard.py compatibility.
    """
    mock_redis = AsyncMock()
    pipe = MagicMock()
    pipe.incr.return_value = None
    pipe.expire.return_value = None
    pipe.execute = AsyncMock(return_value=execute_return)
    mock_redis.pipeline = MagicMock(return_value=pipe)

    # Derive the Lua result from the legacy execute tuple: the caller
    # configured [req_count, _, tok_count, _] — map onto the P3 shape.
    req_count = int(execute_return[0])
    tok_count = int(execute_return[2])
    mock_redis.eval = AsyncMock(
        return_value=[1, req_count, tok_count, 0, 0]  # allowed by default
    )
    return mock_redis


def _make_redis_mock_exceeded(req_count: int, tok_count: int, reason_idx: int):
    """Redis mock whose Lua call reports a specific limit breach."""
    mock_redis = AsyncMock()
    mock_redis.pipeline = MagicMock()
    mock_redis.eval = AsyncMock(
        return_value=[0, req_count, tok_count, 30, reason_idx]
    )
    return mock_redis


@pytest.mark.asyncio
async def test_quota_rpm_exceeded() -> None:
    """RPM 超限 -> QuotaExceededError."""
    cfg = QuotaConfig(rpm_limit=2, tpm_limit=100_000, window_sec=60)
    mock_redis = _make_redis_mock_exceeded(3, 100, reason_idx=1)
    bucket = RedisTokenBucket(redis_client=mock_redis, config=cfg)
    with pytest.raises(QuotaExceededError, match="Quota exceeded"):
        await bucket.acquire(tenant_id="acme", estimated_tokens=100)


@pytest.mark.asyncio
async def test_quota_tpm_exceeded() -> None:
    """TPM 超限 -> QuotaExceededError."""
    cfg = QuotaConfig(rpm_limit=100, tpm_limit=1000, window_sec=60)
    mock_redis = _make_redis_mock_exceeded(1, 1500, reason_idx=2)
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