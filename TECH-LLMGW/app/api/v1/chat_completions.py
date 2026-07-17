"""OpenAI-compatible chat completions endpoint.

Phase 2 acceptance fix: the LLM Gateway used to expose only
``/chat/multimodal`` which expects a vision payload. TECH-AGENT and any
OpenAI-style client call ``/chat/completions`` with a plain ``messages``
array. This thin wrapper accepts that contract and routes through the
existing ``ChatService.text_chat`` so the path is uniform.
"""

from __future__ import annotations

import time
from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.chat.service import ChatService
from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_chat_service
from app.common.errors import (
    AllProvidersFailedError,
    InvalidParamError,
    ModelNotAvailableError,
)

router = APIRouter(tags=["chat-completions"])


class ChatCompletionMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatCompletionMessage] = Field(min_length=1, max_length=64)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=8192)
    system: Optional[str] = None


def _flatten_text(messages: List[ChatCompletionMessage], system: Optional[str]) -> str:
    parts: list[str] = []
    if system:
        parts.append(f"[system]\n{system}")
    for m in messages:
        parts.append(f"[{m.role}]\n{m.content}")
    return "\n\n".join(parts)


@router.post("/chat/completions", summary="OpenAI 兼容纯文本对话")
async def chat_completions(
    request: Request,
    body: ChatCompletionRequest,
    ctx: RequestContext = Depends(request_context_dep),
    service: ChatService = Depends(get_chat_service),
) -> dict:
    """Thin OpenAI-compatible wrapper.

    Accepts ``{model, messages, temperature, max_tokens, system}`` and
    returns a minimal ``{id, model, choices, usage}`` envelope that
    matches the OpenAI ChatCompletion shape. Internally routes through
    ``ChatService.text_chat`` so multimodal/vision capabilities remain
    available; if the model is not a CHAT/MULTIMODAL the existing
    ``ModelNotAvailableError`` is propagated as 422.
    """

    text = _flatten_text(body.messages, body.system)
    if not text.strip():
        raise InvalidParamError("messages 内容不能为空")

    start = time.monotonic()
    resp = service.text_chat(
        ctx.tenant_id,
        body.model,
        text,
        system_prompt=body.system,
        temperature=body.temperature,
        max_tokens=body.max_tokens if body.max_tokens is not None else 1024,
    )
    elapsed_ms = resp.latencyMs + int((time.monotonic() - start) * 1000)

    return success(
        {
            "id": resp.id,
            "model": body.model,
            "provider": resp.provider,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": resp.content},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "promptTokens": resp.usage.promptTokens,
                "completionTokens": resp.usage.completionTokens,
                "totalTokens": resp.usage.totalTokens,
            },
            "latencyMs": elapsed_ms,
        },
        trace_id=ctx.trace_id,
    )
