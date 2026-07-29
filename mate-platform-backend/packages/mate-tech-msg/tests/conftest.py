"""Conftest for mate-tech-msg (ST-5.1.12.1)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from mate_tech_msg.dedup import DedupStore
from mate_tech_msg.kafka_client import KafkaClient


@pytest.fixture
def kafka_client_with_mock_producer() -> KafkaClient:
    """KafkaClient whose producer.send_and_wait returns a fresh
    metadata-like object on every call. Tests can read .partition,
    ".offset" and assert .send_and_wait was called."""
    client = KafkaClient(bootstrap_servers="mock://localhost:9092")
    producer_mock = AsyncMock()
    # Return a value with .partition/.offset attributes; AsyncMock
    # set as return_value gets unwrapped once at await time.
    meta = type("Meta", (), {"partition": 0, "offset": 0})()
    producer_mock.send_and_wait = AsyncMock(return_value=meta)
    client._producer = producer_mock
    return client


@pytest.fixture
def dedup_mock() -> DedupStore:
    store = DedupStore.__new__(DedupStore)
    store._redis = AsyncMock()
    store._ttl = 7 * 24 * 3600
    return store
