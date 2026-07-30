"""Conftest for mate-tech-msg (ST-5.1.12.1)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest



# BUSINESS-SLICES P1 wave 2: ensure cross-package paths work
# without `pip install -e .`. The block is appended after all
# `from __future__` and standard imports to keep Python happy.
import sys as _bsl_sys
from pathlib import Path as _bsl_Path
_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-msg",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)
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
