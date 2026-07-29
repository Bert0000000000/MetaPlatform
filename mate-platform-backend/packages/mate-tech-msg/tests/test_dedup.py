"""Dedup store tests (ST-5.1.8)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from mate_tech_msg.dedup import DedupResult, DedupStore


@pytest.mark.asyncio
async def test_first_store_succeeds() -> None:
    mock_redis = AsyncMock()
    mock_redis.set = AsyncMock(return_value=True)
    store = DedupStore(redis_client=mock_redis, ttl_sec=3600)
    result = await store.check_and_store(key="idem-1", payload_id="payload-A")
    assert result.hit is False
    assert result.stored is True


@pytest.mark.asyncio
async def test_duplicate_hit() -> None:
    mock_redis = AsyncMock()
    mock_redis.set = AsyncMock(return_value=None)
    mock_redis.get = AsyncMock(return_value="payload-A")
    store = DedupStore(redis_client=mock_redis, ttl_sec=3600)
    result = await store.check_and_store(key="idem-1", payload_id="payload-B")
    assert result.hit is True
    assert result.stored is False


@pytest.mark.asyncio
async def test_dedup_ttl_default() -> None:
    mock_redis = AsyncMock()
    mock_redis.set = AsyncMock(return_value=True)
    store = DedupStore(redis_client=mock_redis)
    await store.check_and_store(key="k", payload_id="p")
    call_args = mock_redis.set.call_args
    assert call_args.kwargs.get("ex") == 7 * 24 * 3600


def test_dedup_result_dataclass() -> None:
    r = DedupResult(hit=True, stored=False)
    assert r.hit is True
    assert r.stored is False
