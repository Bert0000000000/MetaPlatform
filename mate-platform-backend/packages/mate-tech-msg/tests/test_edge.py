"""Edge case tests for mate-tech-msg (ST-5.1.12.2)."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock

from mate_tech_msg.dedup import DedupResult, DedupStore
from mate_tech_msg.kafka_client import KafkaClient
from mate_tech_msg.publisher import Publisher
from mate_tech_msg.schemas import PublishRequest, PublishResponse


@pytest.mark.asyncio
async def test_publish_default_partition_key_from_tenant() -> None:
    """无 partition_key → payload.tenant_id 自动."""
    client = KafkaClient(bootstrap_servers="mock://localhost:9092")
    client._producer = AsyncMock()
    client._producer.send_and_wait = AsyncMock(
        return_value=type("Meta", (), {"partition": 1, "offset": 200})()
    )
    dedup = DedupStore.__new__(DedupStore)
    dedup._redis = AsyncMock()
    dedup._redis.set = AsyncMock(return_value=True)
    dedup._ttl = 7 * 24 * 3600
    publisher = Publisher(kafka=client, dedup=dedup)

    req = PublishRequest(
        topic="t",
        payload={"tenant_id": "acme", "data": "x"},
    )
    resp = await publisher.publish(req)
    assert resp.partition == 1
    assert resp.offset == 200


@pytest.mark.asyncio
async def test_publish_no_idempotency_key_skips_dedup() -> None:
    """无 idempotency_key → 不调 dedup."""
    client = KafkaClient(bootstrap_servers="mock://localhost:9092")
    client._producer = AsyncMock()
    client._producer.send_and_wait = AsyncMock(
        return_value=type("Meta", (), {"partition": 0, "offset": 0})()
    )
    dedup = DedupStore.__new__(DedupStore)
    dedup._redis = AsyncMock()
    dedup._redis.set = AsyncMock()  # 不应被调用
    publisher = Publisher(kafka=client, dedup=dedup)

    req = PublishRequest(topic="t", payload={"x": 1})
    await publisher.publish(req)
    dedup._redis.set.assert_not_called()


@pytest.mark.asyncio
async def test_publish_with_explicit_partition_key() -> None:
    """显式 partition_key 优先."""
    client = KafkaClient(bootstrap_servers="mock://localhost:9092")
    client._producer = AsyncMock()
    client._producer.send_and_wait = AsyncMock(
        return_value=type("Meta", (), {"partition": 5, "offset": 100})()
    )
    dedup = DedupStore.__new__(DedupStore)
    dedup._redis = AsyncMock()
    dedup._redis.set = AsyncMock(return_value=True)
    publisher = Publisher(kafka=client, dedup=dedup)

    req = PublishRequest(
        topic="t",
        payload={"tenant_id": "acme", "x": 1},
        partition_key="user-42",
    )
    await publisher.publish(req)
    call_args = client._producer.send_and_wait.call_args
    assert call_args.kwargs["key"] == "user-42"