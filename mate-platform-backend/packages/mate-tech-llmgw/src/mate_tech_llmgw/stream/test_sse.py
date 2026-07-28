"""SSE tests (ST-5.5.7.2)."""
from __future__ import annotations

import pytest

from mate_tech_llmgw.chat import ChatMessage
from mate_tech_llmgw.stream.sse import sse_stream


@pytest.mark.asyncio
async def test_sse_stream_emits_events() -> None:
    """SSE 输出 data: {json}\\n\\n 格式."""
    events = [
        {"type": "token", "data": {"text": "hello"}},
        {"type": "token", "data": {"text": " world"}},
        {"type": "final", "data": {"finish_reason": "stop"}},
    ]

    async def fake_chat_stream(**kwargs: object):
        for e in events:
            yield e

    msgs = [ChatMessage(role="user", content="hi")]
    chunks = []
    async for chunk in sse_stream(fake_chat_stream, messages=msgs, model="gpt-4o"):
        chunks.append(chunk)

    assert len(chunks) == 3
    assert chunks[0].startswith("data: ")
    assert chunks[0].endswith("\n\n")
    # 第 1 块含 token
    assert '"type": "token"' in chunks[0]
    # 最后一块含 final
    assert '"finish_reason": "stop"' in chunks[-1]


@pytest.mark.asyncio
async def test_sse_stream_empty() -> None:
    """无事件 → 空流."""
    async def fake_chat_stream(**kwargs: object):
        if False:
            yield

    msgs = [ChatMessage(role="user", content="hi")]
    chunks = []
    async for chunk in sse_stream(fake_chat_stream, messages=msgs, model="gpt-4o"):
        chunks.append(chunk)
    assert chunks == []