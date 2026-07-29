"""Kafka client tests (ST-5.1.3)."""
from __future__ import annotations

import pytest

from mate_tech_msg.kafka_client import KafkaClient, create_kafka_client


def test_create_client_default() -> None:
    c = create_kafka_client()
    assert c._bootstrap == "localhost:9092"
    assert c._client_id == "mate-tech-msg"


def test_create_client_custom() -> None:
    c = KafkaClient(bootstrap_servers="kafka:9092", client_id="custom")
    assert c._bootstrap == "kafka:9092"
    assert c._client_id == "custom"


def test_client_lazy_producer() -> None:
    c = KafkaClient()
    assert c._producer is None


@pytest.mark.asyncio
async def test_send_uses_mock_producer(kafka_client_with_mock_producer) -> None:
    client = kafka_client_with_mock_producer
    partition, offset = await client.send("test.topic", {"x": 1}, key="k1")
    assert partition == 0
    assert offset == 0
    client._producer.send_and_wait.assert_called_once()


@pytest.mark.asyncio
async def test_stop_producer_safe_when_none() -> None:
    c = KafkaClient()
    await c.stop_producer()
