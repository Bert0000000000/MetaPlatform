"""Subscriber tests (ST-5.1.5)."""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_tech_msg.subscriber import DLQ_TOPIC, MAX_RETRIES, Subscriber


def test_subscriber_constants() -> None:
    assert DLQ_TOPIC == "mate.msg.dlq"
    assert MAX_RETRIES == 3


def test_subscriber_default_group() -> None:
    s = Subscriber(topics=["t"])
    assert s._group_id == "tech-msg"  # pyright: ignore[reportPrivateUsage]
    assert s._max_retries == 3  # pyright: ignore[reportPrivateUsage]
    assert s._dlq_topic == "mate.msg.dlq"  # pyright: ignore[reportPrivateUsage]


def test_subscriber_custom_group() -> None:
    s = Subscriber(topics=["t"], group_id="custom", max_retries=5)
    assert s._group_id == "custom"  # pyright: ignore[reportPrivateUsage]
    assert s._max_retries == 5  # pyright: ignore[reportPrivateUsage]


def test_subscriber_consumer_lazy() -> None:
    s = Subscriber(topics=["t"])
    assert s._consumer is None  # pyright: ignore[reportPrivateUsage]


@pytest.mark.asyncio
async def test_subscriber_retry_then_success() -> None:
    """handler 失败 2 次后成功 — 不入 DLQ."""
    s = Subscriber(topics=["t"], max_retries=3)
    mock_consumer = MagicMock()
    mock_msg = MagicMock()
    mock_msg.value = b"{}"  # bytes，deserialized to dict
    mock_msg.topic = "t"
    mock_msg.partition = 0
    mock_msg.offset = 100
    mock_msg.headers = []
    mock_consumer.getone = AsyncMock(return_value=mock_msg)
    mock_consumer.commit = AsyncMock()
    s._consumer = mock_consumer  # pyright: ignore[reportPrivateUsage]

    attempts = {"n": 0}

    async def flaky_handler(value: dict[str, Any], headers: dict[str, bytes]) -> None:
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise RuntimeError("transient")

    s._handler = flaky_handler  # pyright: ignore[reportPrivateUsage]
    await s.process_one()
    assert attempts["n"] == 3
    mock_consumer.commit.assert_called_once()  # 成功后提交


@pytest.mark.asyncio
async def test_subscriber_dlq_after_max_retries() -> None:
    """handler 持续失败 → 走 DLQ 路径（不入 commit）."""
    s = Subscriber(topics=["t"], max_retries=3)
    mock_consumer = MagicMock()
    mock_msg = MagicMock()
    mock_msg.value = b"{}"
    mock_msg.topic = "t"
    mock_msg.partition = 0
    mock_msg.offset = 200
    mock_msg.headers = []
    mock_consumer.getone = AsyncMock(return_value=mock_msg)
    mock_consumer.commit = AsyncMock()
    s._consumer = mock_consumer  # pyright: ignore[reportPrivateUsage]

    async def always_fail(value: dict[str, Any], headers: dict[str, bytes]) -> None:
        raise RuntimeError("permanent")

    s._handler = always_fail  # pyright: ignore[reportPrivateUsage]
    await s.process_one()
    # max_retries=3 都失败，未 commit（DLQ 路径）
    mock_consumer.commit.assert_not_called()
