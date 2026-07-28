"""SSE 流式 (ST-5.7.9).

`/api/v1/agent/chat/stream` 输出 token + tool_call + final 三类事件。
"""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


async def sse_stream(
    agent_stream_fn: Any,
    *,
    user_input: str,
    session_id: str | None = None,
) -> AsyncIterator[str]:
    """SSE 事件流生成器.

    事件格式:
        data: {"type": "token", "text": "..."}\\n\\n
        data: {"type": "tool_call", "name": "kb_search", "args": {...}}\\n\\n
        data: {"type": "final", "answer": "...", "metadata": {...}}\\n\\n
    """
    import time
    started_at = time.time()
    async for event in agent_stream_fn(user_input=user_input, session_id=session_id):
        yield "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"
    logger.info("agent.stream.completed", session=session_id, duration_ms=(time.time() - started_at) * 1000)