"""OpenAI Provider (ST-5.5.3.1).

支持 GPT-4o / GPT-4o-mini / GPT-3.5-turbo 等。
"""
from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

from ..chat import ChatMessage, ChatResponse

logger = structlog.get_logger(__name__)


class OpenAIChatProvider:
    """OpenAI Chat Completions API 包装."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "gpt-4o",
        base_url: str = "https://api.openai.com/v1",
        timeout: float = 30.0,
    ) -> None:
        self.model = model
        self._api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self._base_url = base_url
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers={"Authorization": f"Bearer {self._api_key}"},
        )

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 1.0,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> ChatResponse:
        """调 OpenAI Chat Completions."""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": m.role, "content": m.content, **({"name": m.name} if m.name else {})}
                for m in messages
            ],
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if tools:
            payload["tools"] = tools

        resp = await self._client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        choice = data["choices"][0]
        message = choice["message"]
        usage = data.get("usage", {})

        return ChatResponse(
            content=message.get("content", "") or "",
            model=data["model"],
            finish_reason=choice.get("finish_reason"),
            tool_calls=message.get("tool_calls", []) or [],
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
        )

    @property
    def dim(self) -> int:
        return 0

    async def aclose(self) -> None:
        await self._client.aclose()