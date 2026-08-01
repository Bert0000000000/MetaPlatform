"""mate_app_copilot.llm.anthropic_provider — Anthropic Provider (TD-6).

Calls the Anthropic Messages API over ``httpx.AsyncClient``. The
provider is selected by ``factory.get_provider()`` when
``ANTHROPIC_API_KEY`` is set and ``OPENAI_API_KEY`` is not (OpenAI
wins when both are set, to match the factory's documented precedence).

Env vars:
    ANTHROPIC_API_KEY    — required (without it, factory never picks Anthropic)
    ANTHROPIC_BASE_URL   — optional, defaults to https://api.anthropic.com
    ANTHROPIC_MODEL      — optional, defaults to claude-3-5-sonnet-20241022
"""
from __future__ import annotations

import json
import os
from typing import Any, AsyncIterator

import httpx

from .base import LLMResponse

ANTHROPIC_API_VERSION = "2023-06-01"
DEFAULT_BASE_URL = "https://api.anthropic.com"
DEFAULT_MODEL = "claude-3-5-sonnet-20241022"
DEFAULT_MAX_TOKENS = 4096
DEFAULT_TIMEOUT = 30.0


class AnthropicProvider:
    """Async LLMProvider implementation calling Anthropic Messages."""

    provider_type = "anthropic"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> None:
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self._base_url = (
            base_url or os.getenv("ANTHROPIC_BASE_URL", DEFAULT_BASE_URL)
        ).rstrip("/")
        self.model = model or os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL)
        self._max_tokens = (
            max_tokens if max_tokens is not None else DEFAULT_MAX_TOKENS
        )
        self._timeout = (
            timeout if timeout is not None else DEFAULT_TIMEOUT
        )
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout,
            headers={
                "x-api-key": self._api_key,
                "anthropic-version": ANTHROPIC_API_VERSION,
            },
        )

    @staticmethod
    def _split_system(
        messages: list[dict[str, Any]],
    ) -> tuple[str, list[dict[str, Any]]]:
        """Split system messages from chat messages (Anthropic API requirement).

        The Anthropic Messages API takes ``system`` as a top-level
        parameter, not as a chat message. We collect every
        ``role == "system"`` message into a single string and pass
        everything else through as ``messages``.
        """
        system_parts: list[str] = []
        chat_msgs: list[dict[str, Any]] = []
        for m in messages:
            if m.get("role") == "system":
                content = str(m.get("content", ""))
                if content:
                    system_parts.append(content)
            else:
                chat_msgs.append(
                    {
                        "role": m.get("role", "user"),
                        "content": m.get("content", ""),
                    }
                )
        return "\n\n".join(system_parts), chat_msgs

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tenant_id: str = "",
        trace_id: str = "",
        **kwargs: Any,
    ) -> LLMResponse:
        system, chat_msgs = self._split_system(messages)
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": chat_msgs,
            "max_tokens": kwargs.pop("max_tokens", self._max_tokens),
        }
        if system:
            payload["system"] = system
        # pass-through remaining kwargs (temperature, tools, ...)
        payload.update(kwargs)
        resp = await self._client.post("/v1/messages", json=payload)
        resp.raise_for_status()
        data = resp.json()
        content_text = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                content_text += block.get("text", "")
        usage = data.get("usage", {})
        return LLMResponse(
            content=content_text,
            model=data.get("model", self.model),
            finish_reason=data.get("stop_reason"),
            usage={
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
                "total_tokens": (
                    usage.get("input_tokens", 0)
                    + usage.get("output_tokens", 0)
                ),
            },
            metadata={
                "provider_type": self.provider_type,
                "tenant_id": tenant_id,
                "trace_id": trace_id,
                "model": self.model,
                "endpoint": str(self._client.base_url),
            },
            lineage_hints=self._lineage(tenant_id, trace_id),
        )

    async def stream(
        self,
        messages: list[dict[str, Any]],
        *,
        tenant_id: str = "",
        trace_id: str = "",
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        system, chat_msgs = self._split_system(messages)
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": chat_msgs,
            "max_tokens": kwargs.pop("max_tokens", self._max_tokens),
            "stream": True,
        }
        if system:
            payload["system"] = system
        payload.update(kwargs)
        async with self._client.stream(
            "POST", "/v1/messages", json=payload
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[len("data: ") :]
                try:
                    chunk = json.loads(data_str)
                    if chunk.get("type") == "content_block_delta":
                        delta = chunk.get("delta", {})
                        text = delta.get("text", "")
                        if text:
                            yield text
                except (ValueError, KeyError):
                    continue

    async def embed(
        self,
        texts: list[str],
        *,
        tenant_id: str = "",
        trace_id: str = "",
    ) -> list[list[float]]:
        # Anthropic has no native embeddings endpoint; fall back to a
        # deterministic hash vector so callers don't crash. This matches
        # the contract documented in base.LLMProvider.embed.
        from . import stub_provider

        return stub_provider.embeddings(texts)

    async def aclose(self) -> None:
        await self._client.aclose()

    def _lineage(self, tenant_id: str, trace_id: str) -> dict[str, Any]:
        """Build lineage hints (ADR-0016 §3.1 + §13 hard rule 9)."""
        return {
            "tenant_id": tenant_id,
            "correlation_id": trace_id,
            "source_system": "mate-app-copilot",
            "provider": self.provider_type,
            "model": self.model,
        }
