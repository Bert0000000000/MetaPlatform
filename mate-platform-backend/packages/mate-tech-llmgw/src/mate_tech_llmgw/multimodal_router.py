"""Multi-provider multimodal router (扩展能力 — backlog §3.3).

Dispatches ``multimodal_chat(model, messages)`` to the right
provider adapter. Routing reuses the same ``_provider_name`` map
as :mod:`mate_tech_llmgw.router` so model→provider resolution is
consistent across text-only and multimodal calls.

Adapter dispatch table
----------------------
* ``openai`` / ``qwen`` / ``doubao`` → :func:`openai_multimodal_chat`
  (OpenAI Vision compatible schema).
* ``anthropic`` → :func:`anthropic_multimodal_chat` (native Messages
  API image block schema).
"""
from __future__ import annotations

from typing import Any

import structlog

from .multimodal import (
    MultimodalChatResponse,
    MultimodalMessage,
)
from .providers.multimodal_anthropic import anthropic_multimodal_chat
from .providers.multimodal_openai import openai_multimodal_chat
from .router import _provider_name, get_provider

logger = structlog.get_logger(__name__)


async def multimodal_chat(
    model: str,
    messages: list[MultimodalMessage],
    *,
    temperature: float = 1.0,
    max_tokens: int | None = None,
    tools: list[dict[str, Any]] | None = None,
    **kwargs: Any,
) -> MultimodalChatResponse:
    """Route a multimodal chat call to the right provider adapter."""
    provider_name = _provider_name(model)
    provider = get_provider(model)

    if provider_name == "anthropic":
        return await anthropic_multimodal_chat(
            provider,
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            tools=tools,
            **kwargs,
        )

    # openai / qwen / doubao all share the OpenAI Vision schema.
    return await openai_multimodal_chat(
        provider,
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
        tools=tools,
        **kwargs,
    )


__all__ = ["multimodal_chat"]
