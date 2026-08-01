"""mate_app_copilot.llm.openai_provider — OpenAI Provider (TD-6).

Calls the OpenAI Chat Completions API over ``httpx.AsyncClient``.
The provider is selected by ``factory.get_provider()`` when
``OPENAI_API_KEY`` is set (and ``ANTHROPIC_API_KEY`` is not — OpenAI
wins the precedence when both are present, matching the factory's
documented order).

Env vars:
    OPENAI_API_KEY    — required (without it, the factory never picks OpenAI)
    OPENAI_BASE_URL   — optional, defaults to https://api.openai.com/v1
    OPENAI_MODEL      — optional, defaults to gpt-4o-mini
"""
from __future__ import annotations

import json
import os
from typing import Any, AsyncIterator

import httpx

from .base import LLMResponse

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TIMEOUT = 30.0


class OpenAIProvider:
    """Async LLMProvider implementation calling OpenAI Chat Completions."""

    provider_type = "openai"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self._api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self._base_url = (
            base_url or os.getenv("OPENAI_BASE_URL", DEFAULT_BASE_URL)
        ).rstrip("/")
        self.model = model or os.getenv("OPENAI_MODEL", DEFAULT_MODEL)
        self._timeout = (
            timeout if timeout is not None else DEFAULT_TIMEOUT
        )
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout,
            headers={"Authorization": f"Bearer {self._api_key}"},
        )

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tenant_id: str = "",
        trace_id: str = "",
        **kwargs: Any,
    ) -> LLMResponse:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
        }
        # pass-through kwargs (temperature, max_tokens, tools, ...)
        payload.update(kwargs)
        resp = await self._client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        choice = data["choices"][0]
        message = choice["message"]
        usage = data.get("usage", {})
        return LLMResponse(
            content=message.get("content", "") or "",
            model=data.get("model", self.model),
            finish_reason=choice.get("finish_reason"),
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
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
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": True,
        }
        payload.update(kwargs)
        async with self._client.stream(
            "POST", "/chat/completions", json=payload
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[len("data: ") :]
                if data_str.strip() == "[DONE]":
                    break
                # naive SSE parse — production should use a real JSON
                # streaming parser; for the test mock we only need to
                # yield content chunks.
                try:
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (ValueError, KeyError, IndexError):
                    continue

    async def embed(
        self,
        texts: list[str],
        *,
        tenant_id: str = "",
        trace_id: str = "",
    ) -> list[list[float]]:
        resp = await self._client.post(
            "/embeddings",
            json={"model": self.model, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in data.get("data", [])]

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
