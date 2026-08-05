"""SSE 安装事件通道测试。"""
from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest

from mate_platform.marketplace.api.events import (
    install_event_stream,
    installer_to_sse_payload,
)


def test_sse_payload_format():
    payload = installer_to_sse_payload(uuid.uuid4(), "installed")
    assert "event: marketplace.install.state" in payload
    assert "data:" in payload


def test_sse_payload_includes_failure_reason():
    payload = installer_to_sse_payload(
        uuid.uuid4(), "failed", error="digest mismatch"
    )
    assert "failed" in payload
    assert "digest mismatch" in payload


@pytest.mark.asyncio
async def test_event_stream_terminates_when_pubsub_empty():
    """空 pubsub → generator 第一次拉取即停。"""
    install_id = uuid.uuid4()

    class _EmptyPubSub:
        async def subscribe(self, channel):
            return self

        async def close(self):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise StopAsyncIteration

    gen = install_event_stream(install_id, pubsub=_EmptyPubSub())
    with pytest.raises(StopAsyncIteration):
        await gen.__anext__()