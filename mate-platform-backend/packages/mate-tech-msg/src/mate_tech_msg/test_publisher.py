"""Publisher tests (ST-5.1.4)."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock

from mate_tech_msg.publisher import Publisher
from mate_tech_msg.kafka_client import KafkaClient
from mate_tech_msg.dedup import DedupStore
from mate_tech_msg.schemas import PublishRequest


@pytest.fixture
def mock_dedup() -> DedupStore:
    d = DedupStore.__new__(DedupStore)  # bypass __init__
    d._redis = AsyncMock()
    d._ttl = 3600
    return d


@pytest.fixture
def publisher(kafka_client_with_mock_producer: KafkaClient, mock_dedup: DedupStore) -> Publisher:
    return Publisher(
        kafka=kafka_client_with_mock_producer,
        dedup=mock_dedup,
    )


@pytest.mark.asyncio
async def test_publish_simple(publisher: Publisher, mock_dedup: DedupStore, kafka_client_with_mock_producer: KafkaClient) -> None:
    """无 idempotency: 直接发 Kafka."""
    mock_dedup._redis.set = AsyncMock(return_value=True)
    req = PublishRequest(topic="t", payload={"x": 1})
    resp = await publisher.publish(req)
    assert resp.topic == "t"
    assert resp.idempotency_hit is False
    kafka_client_with_mock_producer.send.assert_called_once()


@pytest.mark.asyncio
async def test_publish_with_partition_key(publisher: Publisher, mock_dedup: DedupStore) -> None:
    mock_dedup._redis.set = AsyncMock(return_value=True)
    req = PublishRequest(
        topic="t",
        payload={"x": 1, "tenant_id": "acme"},
        partition_key="user-42",
    )
    resp = await publisher.publish(req)
    assert resp.idempotency_hit is False


@pytest.mark.asyncio
async def test_publish_idempotency_hit(publisher: Publisher, mock_dedup: DedupStore) -> None:
    """同 key 第二次 → idempotency_hit=True，不发 Kafka."""
    mock_dedup._redis.set = AsyncMock(return_value=None)  # 已存在
    mock_dedup._redis.get = AsyncMock(return_value="prev-payload")
    req = PublishRequest(
        topic="t",
        payload={"x": 1},
        idempotency_key="idem-1",
    )
    resp = await publisher.publish(req)
    assert resp.idempotency_hit is True
    assert resp.partition == -1  # 虚拟响应


@pytest.mark.asyncio
async def test_publish_default_partition_key_from_tenant(publisher: Publisher, mock_dedup: DedupStore, kafka_client_with_mock_producer: KafkaClient) -> None:
    """无 partition_key → payload.tenant_id 自动."""
    mock_dedup._redis.set = AsyncMock(return_value=True)
    req = PublishRequest(
        topic="t",
        payload={"tenant_id": "acme", "data": "x"},
    )
    await publisher.publish(req)
    # 验证 send 被调时 key="acme"
    call_args = kafka_client_with_mock_producer.send.call_args
    assert call_args.kwargs["key"] == "acme"