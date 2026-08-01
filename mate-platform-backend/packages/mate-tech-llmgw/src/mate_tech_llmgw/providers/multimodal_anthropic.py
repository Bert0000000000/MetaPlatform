"""Anthropic multimodal adapter (扩展能力 — backlog §3.3).

Anthropic Messages API uses a different schema for image / document
inputs than OpenAI Vision::

    {
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": "iVBORw0KG..."
                }
            },
            {
                "type": "image",
                "source": {"type": "url", "url": "https://..."}
            }
        ]
    }

Audio and video are not natively supported on Anthropic Messages;
the adapter degrades them to text hints so callers can mix content
parts without 422ing on every provider.
"""
from __future__ import annotations

from typing import Any

import httpx
import structlog

from ..multimodal import (
    MultimodalChatResponse,
    MultimodalContentPart,
    MultimodalMessage,
)

logger = structlog.get_logger(__name__)


def _content_part_to_anthropic(part: MultimodalContentPart) -> dict[str, Any]:
    """Translate a content part to Anthropic Messages API schema."""
    if part.type == "text":
        return {"type": "text", "text": part.text or ""}

    if part.type == "image_url":
        # Anthropic supports URL sources for images since 2024-05.
        return {
            "type": "image",
            "source": {"type": "url", "url": part.url or ""},
        }

    if part.type == "image_base64":
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": part.media_type or "image/png",
                "data": part.data or "",
            },
        }

    if part.type == "audio_url":
        return {
            "type": "text",
            "text": f"[audio url: {part.url}]",
        }

    if part.type == "audio_base64":
        return {
            "type": "text",
            "text": f"[audio base64 ({part.media_type or 'audio/mpeg'})]",
        }

    if part.type == "video_url":
        return {
            "type": "text",
            "text": f"[video url: {part.url}]",
        }

    raise ValueError(f"Unsupported content part type: {part.type}")


def _build_anthropic_payload(
    model: str,
    messages: list[MultimodalMessage],
    *,
    temperature: float = 1.0,
    max_tokens: int | None = None,
    tools: list[dict[str, Any]] | None = None,
    default_max_tokens: int = 4096,
) -> dict[str, Any]:
    """Build the Anthropic Messages JSON payload.

    System messages are pulled out into the top-level ``system``
    field (Anthropic requirement); user / assistant messages are
    forwarded with their content-part arrays.
    """
    system_parts: list[str] = []
    chat_msgs: list[dict[str, Any]] = []
    for m in messages:
        if m.role == "system":
            text_parts = " ".join(p.text or "" for p in m.content if p.type == "text")
            if text_parts:
                system_parts.append(text_parts)
            continue
        parts = [_content_part_to_anthropic(p) for p in m.content]
        chat_msgs.append({"role": m.role, "content": parts})

    payload: dict[str, Any] = {
        "model": model,
        "messages": chat_msgs,
        "max_tokens": max_tokens or default_max_tokens,
        "temperature": temperature,
    }
    if system_parts:
        payload["system"] = "\n\n".join(system_parts)
    if tools:
        payload["tools"] = tools
    return payload


async def _post_and_parse(
    client: httpx.AsyncClient,
    payload: dict[str, Any],
) -> MultimodalChatResponse:
    resp = await client.post("/v1/messages", json=payload)
    resp.raise_for_status()
    data = resp.json()

    content_text = ""
    tool_calls: list[dict[str, Any]] = []
    for block in data.get("content", []):
        if block.get("type") == "text":
            content_text += block["text"]
        elif block.get("type") == "tool_use":
            tool_calls.append(
                {
                    "id": block["id"],
                    "type": "function",
                    "function": {
                        "name": block["name"],
                        "arguments": block.get("input", {}),
                    },
                }
            )

    usage = data.get("usage", {})
    return MultimodalChatResponse(
        content=content_text,
        model=data["model"],
        finish_reason=data.get("stop_reason"),
        tool_calls=tool_calls,
        usage={
            "input_tokens": usage.get("input_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0),
        },
        modality="text",
    )


async def anthropic_multimodal_chat(
    provider: Any,
    messages: list[MultimodalMessage],
    *,
    temperature: float = 1.0,
    max_tokens: int | None = None,
    tools: list[dict[str, Any]] | None = None,
    **kwargs: Any,
) -> MultimodalChatResponse:
    """Run multimodal chat against ``AnthropicChatProvider``.

    ``provider`` must expose ``_client`` (httpx.AsyncClient),
    ``model`` and ``_max_tokens`` — i.e. ``AnthropicChatProvider``.
    """
    default_max_tokens = getattr(provider, "_max_tokens", 4096)
    payload = _build_anthropic_payload(
        provider.model,
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
        tools=tools,
        default_max_tokens=default_max_tokens,
    )
    logger.info(
        "llmgw.multimodal.anthropic.request",
        model=provider.model,
        message_count=len(messages),
    )
    return await _post_and_parse(provider._client, payload)  # noqa: SLF001


__all__ = ["anthropic_multimodal_chat"]
