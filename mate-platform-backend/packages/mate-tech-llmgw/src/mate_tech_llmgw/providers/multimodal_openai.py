"""OpenAI-Vision-compatible multimodal adapter (扩展能力 — backlog §3.3).

OpenAI, Qwen (DashScope compatible mode) and Doubao (ARK) all accept
the OpenAI Chat Completions schema with content-part arrays::

    {
        "model": "gpt-4o",
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": "What's in this image?"},
                {"type": "image_url", "image_url": {"url": "https://...", "detail": "high"}}
            ]
        }]
    }

This adapter reuses the existing ``OpenAIChatProvider`` /
``QwenChatProvider`` / ``DoubaoChatProvider`` httpx clients so that
API keys, timeouts and base URLs stay centralized.

The adapter is a thin mixin/wrapper rather than a subclass — we
keep the original provider classes intact (text-only ``chat`` is
still their canonical method) and add ``multimodal_chat`` as an
extension method via composition.
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


def _content_part_to_openai(part: MultimodalContentPart) -> dict[str, Any]:
    """Translate a :class:`MultimodalContentPart` to OpenAI Vision schema."""
    if part.type == "text":
        return {"type": "text", "text": part.text or ""}

    if part.type == "image_url":
        url = part.url or ""
        block: dict[str, Any] = {"url": url}
        if part.detail:
            block["detail"] = part.detail
        return {"type": "image_url", "image_url": block}

    if part.type == "image_base64":
        # OpenAI accepts data URIs for base64 images.
        media = part.media_type or "image/png"
        data_uri = f"data:{media};base64,{part.data}"
        block = {"url": data_uri}
        if part.detail:
            block["detail"] = part.detail
        return {"type": "image_url", "image_url": block}

    if part.type == "audio_url":
        # OpenAI audio-in (gpt-4o-audio-preview) uses input_audio.
        return {
            "type": "input_audio",
            "input_audio": {"data": part.url, "format": "url"},
        }

    if part.type == "audio_base64":
        return {
            "type": "input_audio",
            "input_audio": {"data": part.data, "format": _audio_format(part.media_type)},
        }

    if part.type == "video_url":
        # OpenAI does not natively accept video URLs; we forward as
        # a text description so the model can reason about the URL.
        # Providers that support video (e.g. Gemini-via-OpenAI proxy)
        # will accept this hint; others will gracefully degrade.
        return {
            "type": "text",
            "text": f"[video url: {part.url}]",
        }

    raise ValueError(f"Unsupported content part type: {part.type}")


def _audio_format(media_type: str | None) -> str:
    """Map a media_type like ``audio/wav`` to OpenAI's ``format`` enum."""
    if not media_type:
        return "mp3"
    # audio/mpeg -> mp3, audio/wav -> wav, audio/ogg -> ogg, etc.
    short = media_type.split("/")[-1]
    if short == "mpeg":
        return "mp3"
    if short in ("wav", "mp3", "ogg", "flac", "aac"):
        return short
    return "mp3"


def _build_openai_payload(
    model: str,
    messages: list[MultimodalMessage],
    *,
    temperature: float = 1.0,
    max_tokens: int | None = None,
    tools: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build the OpenAI Chat Completions JSON payload."""
    api_messages: list[dict[str, Any]] = []
    for m in messages:
        if m.role == "system":
            # System messages remain pure text on the wire.
            text_parts = " ".join(p.text or "" for p in m.content if p.type == "text")
            api_messages.append({"role": "system", "content": text_parts})
            continue
        parts = [_content_part_to_openai(p) for p in m.content]
        api_messages.append({"role": m.role, "content": parts})
    payload: dict[str, Any] = {
        "model": model,
        "messages": api_messages,
        "temperature": temperature,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens
    if tools:
        payload["tools"] = tools
    return payload


async def _post_and_parse(
    client: httpx.AsyncClient,
    payload: dict[str, Any],
) -> MultimodalChatResponse:
    """POST to OpenAI-compatible /chat/completions and parse response."""
    resp = await client.post("/chat/completions", json=payload)
    resp.raise_for_status()
    data = resp.json()
    choice = data["choices"][0]
    message = choice["message"]
    usage = data.get("usage", {})
    return MultimodalChatResponse(
        content=message.get("content", "") or "",
        model=data["model"],
        finish_reason=choice.get("finish_reason"),
        tool_calls=message.get("tool_calls", []) or [],
        usage={
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
        },
        modality="text",
    )


async def openai_multimodal_chat(
    provider: Any,
    messages: list[MultimodalMessage],
    *,
    temperature: float = 1.0,
    max_tokens: int | None = None,
    tools: list[dict[str, Any]] | None = None,
    **kwargs: Any,
) -> MultimodalChatResponse:
    """Run multimodal chat against any OpenAI-compatible provider.

    ``provider`` must expose ``_client`` (httpx.AsyncClient) and
    ``model`` — i.e. ``OpenAIChatProvider`` / ``QwenChatProvider`` /
    ``DoubaoChatProvider``.
    """
    payload = _build_openai_payload(
        provider.model,
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
        tools=tools,
    )
    logger.info(
        "llmgw.multimodal.openai.request",
        model=provider.model,
        message_count=len(messages),
    )
    return await _post_and_parse(provider._client, payload)  # noqa: SLF001


__all__ = ["openai_multimodal_chat"]
