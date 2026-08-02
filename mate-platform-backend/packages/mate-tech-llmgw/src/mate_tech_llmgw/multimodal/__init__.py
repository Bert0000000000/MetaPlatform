"""Multimodal chat types & routing (扩展能力 — backlog §3.3 + v3.2 W2).

This package hosts two layers:

1. **OpenAI-Vision / Anthropic compatible types** —
   :class:`MultimodalContentPart`, :class:`MultimodalMessage`,
   :class:`MultimodalChatResponse`, :class:`MultimodalChatProvider` —
   consumed by :mod:`mate_tech_llmgw.multimodal_router` and the
   ``providers/multimodal_*.py`` adapters.
2. **v3.2 W2 simplified engine** — :class:`MultimodalEngine`,
   :class:`MultimodalRequest`, :class:`MultimodalResponse`,
   :class:`StubMultimodalProvider` (re-exported from
   :mod:`mate_tech_llmgw.multimodal.engine`) — a flattened
   prompt + images + audio interface with an injectable provider.

PRD-APP-COPILOT §3.5 calls for image / audio / video inputs to the
LLM gateway. The OpenAI-Vision types model full content-part arrays;
the v3.2 W2 engine offers a simpler entry point for callers that only
need text + image + audio references → text output.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, runtime_checkable

# Supported content-part types. ``text`` is always supported; the
# media types are best-effort — providers may 422 if a particular
# media type is unsupported (e.g. video on Anthropic).
ContentPartType = Literal[
    "text",
    "image_url",
    "image_base64",
    "audio_url",
    "audio_base64",
    "video_url",
]


@dataclass(frozen=True, slots=True)
class MultimodalContentPart:
    """Single content part within a multimodal message.

    Examples
    --------
    >>> MultimodalContentPart(type="text", text="What is in this image?")
    >>> MultimodalContentPart(
    ...     type="image_url",
    ...     url="https://example.com/cat.png",
    ...     media_type="image/png",
    ... )
    >>> MultimodalContentPart(
    ...     type="image_base64",
    ...     data="iVBORw0KG...",
    ...     media_type="image/png",
    ... )
    """

    type: ContentPartType
    text: str | None = None
    url: str | None = None
    data: str | None = None
    media_type: str | None = None
    detail: str | None = None  # OpenAI vision "detail": low/high/auto

    def __post_init__(self) -> None:
        # Validate that the required field for each type is present.
        if self.type == "text" and not self.text:
            raise ValueError("text content part requires non-empty 'text'")
        if self.type.endswith("_url") and not self.url:
            raise ValueError(f"{self.type} content part requires 'url'")
        if self.type.endswith("_base64") and not self.data:
            raise ValueError(f"{self.type} content part requires 'data'")


@dataclass(frozen=True, slots=True)
class MultimodalMessage:
    """Multimodal chat message — role + list of content parts.

    Mirrors :class:`mate_tech_llmgw.chat.ChatMessage` but replaces
    the ``content: str`` field with ``content: list[MultimodalContentPart]``
    so a single message can carry text + image + audio together.
    """

    role: str
    content: list[MultimodalContentPart] = field(default_factory=list)
    name: str | None = None
    tool_call_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class MultimodalChatResponse:
    """Multimodal chat response.

    Today every supported provider returns text-only responses — the
    response shape is identical to :class:`ChatResponse`. We keep a
    separate type so future binary-output providers (TTS, image-gen)
    can extend it without breaking existing callers.
    """

    content: str
    model: str
    finish_reason: str | None = None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    modality: str = "text"  # which output modality the provider used


@runtime_checkable
class MultimodalChatProvider(Protocol):
    """Multimodal chat provider interface.

    All four implemented providers (OpenAI, Anthropic, Qwen, Doubao)
    honour this contract; the OpenAI / Qwen / Doubao adapters share
    the same wire format (OpenAI Vision), Anthropic uses its native
    Messages API image block schema.
    """

    model: str

    async def multimodal_chat(
        self,
        messages: list[MultimodalMessage],
        *,
        temperature: float = 1.0,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> MultimodalChatResponse: ...


# ---------------------------------------------------------------------------
# v3.2 W2: simplified engine (text + image + audio → text).
# Re-exported here so ``from mate_tech_llmgw.multimodal import
# MultimodalEngine`` resolves alongside the legacy content-part types.
# ---------------------------------------------------------------------------
from .engine import (  # noqa: E402
    MultimodalEngine,
    MultimodalProviderProtocol,
    MultimodalRequest,
    MultimodalResponse,
    StubMultimodalProvider,
)

__all__ = [
    "ContentPartType",
    "MultimodalChatProvider",
    "MultimodalChatResponse",
    "MultimodalContentPart",
    "MultimodalEngine",
    "MultimodalMessage",
    "MultimodalProviderProtocol",
    "MultimodalRequest",
    "MultimodalResponse",
    "StubMultimodalProvider",
]
