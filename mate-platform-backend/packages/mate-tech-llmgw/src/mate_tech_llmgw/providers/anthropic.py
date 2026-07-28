"""Anthropic Provider (ST-5.5.3.1).

支持 Claude 3.5 / Claude 3 系列。
"""
from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

from ..chat import ChatMessage, ChatResponse

logger = structlog.get_logger(__name__)

ANTHROPIC_API_VERSION = "2023-06-01"


class AnthropicChatProvider:
    """Anthropic Messages API 包装."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "claude-3-5-sonnet-20241022",
        base_url: str = "https://api.anthropic.com",
        timeout: float = 30.0,
        max_tokens: int = 4096,
    ) -> None:
        self.model = model
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self._base_url = base_url
        self._max_tokens = max_tokens
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers={
                "x-api-key": self._api_key,
                "anthropic-version": ANTHROPIC_API_VERSION,
            },
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
        """调 Anthropic Messages API."""
        system_parts: list[str] = []
        chat_msgs: list[dict[str, Any]] = []
        for m in messages:
            if m.role == "system":
                system_parts.append(m.content)
            else:
                chat_msgs.append({"role": m.role, "content": m.content})

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": chat_msgs,
            "max_tokens": max_tokens or self._max_tokens,
            "temperature": temperature,
        }
        if system_parts:
            payload["system"] = "\n\n".join(system_parts)
        if tools:
            payload["tools"] = tools

        resp = await self._client.post("/v1/messages", json=payload)
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
        return ChatResponse(
            content=content_text,
            model=data["model"],
            finish_reason=data.get("stop_reason"),
            tool_calls=tool_calls,
            usage={
                "input_tokens": usage.get("input_tokens", 0),
                "output_tokens": usage.get("output_tokens", 0),
            },
        )

    @property
    def dim(self) -> int:
        return 0

    async def aclose(self) -> None:
        await self._client.aclose()