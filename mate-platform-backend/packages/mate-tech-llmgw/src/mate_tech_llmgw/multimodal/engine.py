"""Multimodal engine — text + image + audio → text (v3.2 W2).

Provides a simplified multimodal chat interface backed by an
injectable provider. The default :class:`StubMultimodalProvider`
returns a deterministic response suitable for tests and offline
development.

Design
------
* :class:`MultimodalRequest` flattens the inputs to ``prompt`` plus
  ``images`` / ``audio`` reference lists (base64 data URIs or URLs).
* :class:`MultimodalEngine` converts the request into a provider-
  facing ``messages`` payload and delegates to ``provider.chat``.
* The provider protocol is intentionally narrow
  (``async chat(messages, model) -> dict``) so a test double or a
  real OpenAI-Vision / Anthropic adapter can be dropped in.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from mate_platform.runtime import reject_production_fallback


@dataclass
class MultimodalRequest:
    """Simplified multimodal request.

    ``images`` / ``audio`` are base64 data URIs
    (``data:image/png;base64,...``) or remote URLs (``https://...``).
    The engine does not fetch or validate the bytes; it forwards the
    references to the provider unchanged.
    """

    prompt: str
    images: list[str] = field(default_factory=list)
    audio: list[str] = field(default_factory=list)
    model: str = "gpt-4o-mini"


@dataclass
class MultimodalResponse:
    """Multimodal response — text output + usage stats."""

    content: str
    model: str
    usage: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class MultimodalProviderProtocol(Protocol):
    """Provider interface: ``async chat(messages, model) -> dict``.

    The returned dict must carry ``content`` (str), ``model`` (str)
    and ``usage`` (dict).
    """

    async def chat(
        self,
        messages: list[dict[str, Any]],
        model: str,
    ) -> dict[str, Any]: ...


class StubMultimodalProvider:
    """Deterministic stub provider.

    Counts the image parts carried in the messages and returns a
    fixed response, so tests can assert exact output without any
    network IO. Output mirrors the shape a real provider returns.
    """

    async def chat(
        self,
        messages: list[dict[str, Any]],
        model: str,
    ) -> dict[str, Any]:
        reject_production_fallback("multimodal provider")
        image_count = 0
        for message in messages:
            parts = message.get("content")
            if not isinstance(parts, list):
                continue
            for part in parts:
                if isinstance(part, dict) and part.get("type") == "image":
                    image_count += 1
        return {
            "content": f"[stub] Image analysis for {image_count} images",
            "model": model,
            "usage": {"total_tokens": 100},
        }


class MultimodalEngine:
    """Multimodal chat engine.

    Wraps a provider and exposes :meth:`chat`, which takes a
    :class:`MultimodalRequest` and returns a :class:`MultimodalResponse`.
    The provider is injectable for testing; the default is
    :class:`StubMultimodalProvider`.
    """

    def __init__(self, provider: MultimodalProviderProtocol | None = None) -> None:
        if provider is None:
            reject_production_fallback("multimodal provider")
        self.provider: MultimodalProviderProtocol = provider or StubMultimodalProvider()

    async def chat(self, request: MultimodalRequest) -> MultimodalResponse:
        """Run a multimodal request through the configured provider."""
        messages = self._build_messages(request)
        result = await self.provider.chat(messages, request.model)
        return MultimodalResponse(
            content=result["content"],
            model=result["model"],
            usage=result["usage"],
        )

    @staticmethod
    def _build_messages(request: MultimodalRequest) -> list[dict[str, Any]]:
        """Flatten the request into a single-user-message payload."""
        content: list[dict[str, Any]] = [
            {"type": "text", "text": request.prompt}
        ]
        for image in request.images:
            content.append({"type": "image", "image": image})
        for clip in request.audio:
            content.append({"type": "audio", "audio": clip})
        return [{"role": "user", "content": content}]


__all__ = [
    "MultimodalEngine",
    "MultimodalProviderProtocol",
    "MultimodalRequest",
    "MultimodalResponse",
    "StubMultimodalProvider",
]
