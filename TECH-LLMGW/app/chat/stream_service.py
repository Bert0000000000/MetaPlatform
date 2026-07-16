"""Streaming chat service (S-LLMGW-04).

Wraps the existing ``ChatService.multimodal`` call and emits the response
as SSE-compatible chunks.  The full response is obtained synchronously from
the provider (mock in Phase 2) **before** the ``StreamingResponse`` starts,
so that business errors (404, 422, …) are raised while the exception
handler can still set the HTTP status code.  The pre-computed content is
then split into 5-10 chunks with a 50 ms delay between each to simulate
streaming behaviour.
"""

from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator, List

from app.chat.schemas import MultimodalRequest, MultimodalResponse, StreamChatRequest

# Number of content chunks to emit (exclusive of the final ``done`` frame).
_MIN_CHUNKS = 5
_MAX_CHUNKS = 10
_CHUNK_DELAY = 0.05  # seconds


def _split_content(content: str) -> List[str]:
    """Split ``content`` into between 5 and 10 roughly equal chunks."""

    if not content:
        return [""]

    n = min(_MAX_CHUNKS, max(_MIN_CHUNKS, len(content) // 8 or _MIN_CHUNKS))
    n = min(n, len(content))  # never more chunks than characters
    size = (len(content) + n - 1) // n
    return [content[i : i + size] for i in range(0, len(content), size)]


def build_multimodal_request(request: StreamChatRequest) -> MultimodalRequest:
    """Convert a ``StreamChatRequest`` into a ``MultimodalRequest``."""

    return MultimodalRequest(
        modelId=request.modelId,
        text=request.text,
        images=list(request.images),
        temperature=request.temperature,
        maxTokens=request.maxTokens,
        systemPrompt=request.systemPrompt,
    )


async def stream_response(resp: MultimodalResponse) -> AsyncGenerator[str, None]:
    """Async generator yielding SSE-formatted chunks from a pre-computed
    ``MultimodalResponse``.

    Each yielded string is a complete SSE ``data:`` line terminated by
    ``\\n\\n``.  The final frame carries ``done: true`` and usage stats.
    """

    chunks = _split_content(resp.content)

    for chunk in chunks:
        payload = json.dumps({"content": chunk, "done": False}, ensure_ascii=False)
        yield f"data: {payload}\n\n"
        await asyncio.sleep(_CHUNK_DELAY)

    # Final frame with usage stats.
    final = json.dumps(
        {
            "content": "",
            "done": True,
            "usage": {
                "promptTokens": resp.usage.promptTokens,
                "completionTokens": resp.usage.completionTokens,
            },
        },
        ensure_ascii=False,
    )
    yield f"data: {final}\n\n"
