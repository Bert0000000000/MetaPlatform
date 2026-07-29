"""Conftest for mate-tech-msg (ST-5.1.12.1)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from mate_tech_msg.dedup import DedupStore
from mate_tech_msg.kafka_client import KafkaClient


@pytest.fixture
def kafka_mock() -> KafkaClient:
    client = KafkaClient(bootstrap_servers="mock://localhost:9092")
    client._producer = AsyncMock()
    return client


@pytest.fixture
def dedup_mock() -> DedupStore:
    store = DedupStore.__new__(DedupStore)
    store._redis = AsyncMock()
    store._ttl = 7 * 24 * 3600
    return store
