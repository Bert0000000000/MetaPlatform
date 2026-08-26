"""Real Anthropic Messages API provider with tenant-scoped keys + stub fallback (TD-6).

P3-W7: mirrors the ``RealOpenAIProvider`` design but for the Anthropic
Messages API. Key differences:

  * Uses ``x-api-key`` header (not ``Authorization: Bearer``).
  * Sends the ``anthropic-version`` header.
  * Extracts system prompt from the message list and sends it as a
    top-level ``system`` field (Anthropic convention).
  * Parses ``content`` blocks (``text`` / ``tool_use``) from the
    response.

Tenant-scoped key resolution + stub fallback work identically to the
OpenAI provider.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
import structlog
from mate_platform.runtime import is_production_profile

from ..chat import ChatMessage, ChatResponse

logger = structlog.get_logger(__name__)

_ANTHROPIC_BASE_URL = "https://api.anthropic.com"
_ANTHROPIC_API_VERSION = "2023-06-01"
_DEFAULT_MODEL = "claude-3-5-sonnet-20241022"
_DEFAULT_MAX_TOKENS = 4096


def _stub_response(model: str, messages: list[ChatMessage]) -> ChatResponse:
    """Build a deterministic stub response for fallback."""
    last_user = ""
    for m in reversed(messages):
        if m.role == "user":
            last_user = m.content
            break
    return ChatResponse(
        content=f"[stub-fallback] Anthropic unavailable. Echo: {last_user[:80]}",
        model=model,
        finish_reason="stop",
        usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    )


class RealAnthropicProvider:
    """Real Anthropic provider with tenant key resolution + stub fallback (TD-6)."""

    provider_type = "real-anthropic"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = _DEFAULT_MODEL,
        base_url: str | None = None,
        timeout: float = 30.0,
        max_tokens: int = _DEFAULT_MAX_TOKENS,
        allow_fallback: bool | None = None,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self._base_url = base_url or os.getenv("ANTHROPIC_BASE_URL", _ANTHROPIC_BASE_URL)
        self._timeout = timeout
        self._max_tokens = max_tokens
        self._allow_fallback = (
            not is_production_profile()
            and (True if allow_fallback is None else allow_fallback)
        )
        self._client: httpx.AsyncClient | None = None

    def _resolve_api_key(self, tenant_id: str) -> str:
        """Resolve the API key for a tenant.

        Priority: explicit ``api_key`` > ``ANTHROPIC_API_KEY_{TENANT}`` >
        ``ANTHROPIC_API_KEY``.
        """
        if self._api_key:
            return self._api_key
        if tenant_id:
            tenant_key = f"ANTHROPIC_API_KEY_{tenant_id.upper().replace('-', '_')}"
            val = os.getenv(tenant_key, "")
            if val:
                return val
        return os.getenv("ANTHROPIC_API_KEY", "")

    def _fallback_enabled(self) -> bool:
        """Re-evaluate the deployment profile for long-lived providers."""
        return self._allow_fallback and not is_production_profile()

    async def _get_client(self, api_key: str) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": _ANTHROPIC_API_VERSION,
                },
            )
        return self._client

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 1.0,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
        tenant_id: str = "",
        **kwargs: Any,
    ) -> ChatResponse:
        """Call Anthropic Messages API, falling back to stub on error."""
        api_key = self._resolve_api_key(tenant_id)
        if not api_key:
            logger.warning(
                "llmgw.real.anthropic.no_key",
                tenant_id=tenant_id,
                model=self.model,
            )
            if not self._fallback_enabled():
                raise RuntimeError("Anthropic provider unavailable: API key is not configured")
            return _stub_response(self.model, messages)

        # Anthropic separates system messages from the conversation.
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

        try:
            client = await self._get_client(api_key)
            resp = await client.post("/v1/messages", json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            logger.warning(
                "llmgw.real.anthropic.timeout",
                tenant_id=tenant_id,
                model=self.model,
            )
            if not self._fallback_enabled():
                raise RuntimeError(
                    "Anthropic provider unavailable: request timed out"
                ) from None
            return _stub_response(self.model, messages)
        except httpx.HTTPError as e:
            logger.warning(
                "llmgw.real.anthropic.error",
                tenant_id=tenant_id,
                model=self.model,
                error=str(e),
            )
            if not self._fallback_enabled():
                raise RuntimeError("Anthropic provider unavailable: upstream request failed") from e
            return _stub_response(self.model, messages)

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
            model=data.get("model", self.model),
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
        if self._client is not None:
            await self._client.aclose()
            self._client = None
