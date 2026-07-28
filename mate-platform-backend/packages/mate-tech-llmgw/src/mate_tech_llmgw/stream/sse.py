"""Streaming SSE (ST-5.5.7).

POST /api/v1/llm/chat/stream 输出 SSE。
"""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import structlog
from fastapi.responses import StreamingResponse

from ..chat import ChatMessage

logger = structlog.get_logger(__name__)


async def sse_stream(
    chat_stream_fn: Any,
    *,
    messages: list[ChatMessage],
    model: str,
    temperature: float = 1.0,
    **kwargs: Any,
) -> AsyncIterator[str]:
    """把 chat_stream 的 chunk 流转换为 SSE 字符串.

    Yields:
        SSE 格式字符串: "data: {json}\\n\\n"
    """
    async for event in chat_stream_fn(
        messages=messages,
        model=model,
        temperature=temperature,
        **kwargs,
    ):
        # event 格式: {"type": "token"|"tool_call"|"final", "data": ...}
        yield "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"
        logger.debug("sse.event", type=event.get("type"))


def make_streaming_response(
    chat_stream_fn: Any,
    *,
    messages: list[ChatMessage],
    model: str,
    temperature: float = 1.0,
    **kwargs: Any,
) -> StreamingResponse:
    """构造 FastAPI StreamingResponse."""
    return StreamingResponse(
        sse_stream(
            chat_stream_fn,
            messages=messages,
            model=model,
            temperature=temperature,
            **kwargs,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )