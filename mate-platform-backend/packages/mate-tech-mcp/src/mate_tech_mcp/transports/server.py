"""Transport layer (ST-5.3.5).

stdio (本地) + sse (远端) 双 transport。
"""
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


async def run_stdio(server: Any) -> None:
    """ST-5.3.5: stdio transport."""
    from mcp.server.stdio import stdio_server

    async def arun() -> None:
        actual = await server._ensure_server()
        async with stdio_server() as (read_stream, write_stream):
            await actual.run(
                read_stream, write_stream, actual.create_initialization_options()
            )

    logger.info("mcp.transport.stdio.start")
    await arun()


async def stream_sse(server: Any) -> AsyncIterator[str]:
    """ST-5.3.5: SSE transport (远端).

    Yields:
        SSE 格式事件
    """
    import json
    async for event in server._event_stream():
        yield "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"


def select_transport() -> str:
    """根据 env 选择 transport."""
    return os.getenv("MCP_TRANSPORT", "stdio").lower()