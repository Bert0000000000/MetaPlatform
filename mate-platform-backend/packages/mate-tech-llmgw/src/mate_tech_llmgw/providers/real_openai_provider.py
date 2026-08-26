"""Real OpenAI ChatCompletion provider with tenant-scoped keys + stub fallback (TD-6).

P3-W7: this provider wraps the real OpenAI Chat Completions API via
``httpx.AsyncClient``. Key behaviours:

  * **Tenant-scoped API key**: resolves ``OPENAI_API_KEY_{TENANT}``
    (uppercased, hyphens → underscores) first, then falls back to the
    global ``OPENAI_API_KEY`` env var. This satisfies hard rule 12
    (no secrets in git) + tenant isolation (hard rule 3).
  * **Stub fallback**: when the real call fails (no key, timeout,
    HTTP error), the provider returns a deterministic stub response
    and emits a structlog warning so the caller can still proceed.
  * **Lineage hints**: every response carries ``tenant_id`` +
    ``provider`` metadata (hard rule 9).

The provider implements the same ``chat`` signature as the existing
``OpenAIChatProvider`` so it can be swapped in via the router.
"""
from __future__ import annotations

import json
import os
from typing import Any

import httpx
import structlog

from ..chat import ChatMessage, ChatResponse

logger = structlog.get_logger(__name__)

_OPENAI_BASE_URL = "https://api.openai.com/v1"
_DEFAULT_MODEL = "gpt-4o-mini"


def _stub_response(model: str, messages: list[ChatMessage]) -> ChatResponse:
    """Build a deterministic stub response for fallback."""
    last_user = ""
    for m in reversed(messages):
        if m.role == "user":
            last_user = m.content
            break
    return ChatResponse(
        content=f"[stub-fallback] OpenAI unavailable. Echo: {last_user[:80]}",
        model=model,
        finish_reason="stop",
        usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    )


class RealOpenAIProvider:
    """Real OpenAI provider with tenant key resolution + stub fallback (TD-6)."""

    provider_type = "real-openai"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = _DEFAULT_MODEL,
        base_url: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self._base_url = base_url or os.getenv("OPENAI_BASE_URL", _OPENAI_BASE_URL)
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    def _resolve_api_key(self, tenant_id: str) -> str:
        """Resolve the API key for a tenant.

        Priority: explicit ``api_key`` > ``OPENAI_API_KEY_{TENANT}`` >
        ``OPENAI_API_KEY``.
        """
        if self._api_key:
            return self._api_key
        if tenant_id:
            tenant_key = f"OPENAI_API_KEY_{tenant_id.upper().replace('-', '_')}"
            val = os.getenv(tenant_key, "")
            if val:
                return val
        return os.getenv("OPENAI_API_KEY", "")

    async def _get_client(self, api_key: str) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={"Authorization": f"Bearer {api_key}"},
            )
        return self._client

    @staticmethod
    def _serialize_message(m: ChatMessage) -> dict[str, Any]:
        """Serialize one ChatMessage to the OpenAI-compatible wire shape.

        Preserves the function-calling fields (``tool_call_id`` for ``tool``
        messages, ``tool_calls`` for assistant messages) that the generic
        ``role``+``content`` serialization used to drop.
        """
        msg: dict[str, Any] = {"role": m.role, "content": m.content}
        if m.name:
            msg["name"] = m.name
        if m.tool_call_id:
            msg["tool_call_id"] = m.tool_call_id
        if m.tool_calls:
            msg["tool_calls"] = m.tool_calls
        return msg

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
        """Call OpenAI Chat Completions, falling back to stub on error."""
        api_key = self._resolve_api_key(tenant_id)
        if not api_key:
            logger.warning(
                "llmgw.real.openai.no_key",
                tenant_id=tenant_id,
                model=self.model,
            )
            return _stub_response(self.model, messages)

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [self._serialize_message(m) for m in messages],
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if tools:
            payload["tools"] = tools

        try:
            client = await self._get_client(api_key)
            resp = await client.post("/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            logger.warning(
                "llmgw.real.openai.timeout",
                tenant_id=tenant_id,
                model=self.model,
            )
            return _stub_response(self.model, messages)
        except httpx.HTTPError as e:
            logger.warning(
                "llmgw.real.openai.error",
                tenant_id=tenant_id,
                model=self.model,
                error=str(e),
            )
            return _stub_response(self.model, messages)

        choice = data["choices"][0]
        message = choice["message"]
        usage = data.get("usage", {})
        return ChatResponse(
            content=message.get("content", "") or "",
            model=data.get("model", self.model),
            reasoning_content=(
                message.get("reasoning_content") or message.get("reasoning") or ""
            ),
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

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 1.0,
        max_tokens: int | None = None,
        tools: list[dict[str, Any]] | None = None,
        tenant_id: str = "",
        **kwargs: Any,
    ) -> Any:
        """Stream OpenAI Chat Completions deltas (``stream: true``).

        Yields token / done events with accumulated ``reasoning_content``
        and per-index tool_calls (OpenAI streams arguments as fragments
        that we join). On transport failure yields a single stub done event.
        """
        api_key = self._resolve_api_key(tenant_id)
        if not api_key:
            logger.warning(
                "llmgw.real.openai.stream.no_key",
                tenant_id=tenant_id,
                model=self.model,
            )
            yield self._done_event(_stub_response(self.model, messages))
            return

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [self._serialize_message(m) for m in messages],
            "temperature": temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if tools:
            payload["tools"] = tools

        content = ""
        reasoning = ""
        tool_calls: list[dict[str, Any]] = []
        finish_reason: str | None = None
        usage: dict[str, int] = {}
        try:
            client = await self._get_client(api_key)
            async with client.stream("POST", "/chat/completions", json=payload) as resp:
                resp.raise_for_status()
                async for raw in resp.aiter_lines():
                    if not raw:
                        continue
                    line = raw[6:] if raw.startswith("data: ") else raw
                    if line.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        if chunk.get("usage"):
                            usage = chunk["usage"]
                        continue
                    delta = choices[0].get("delta", {})
                    finish_reason = choices[0].get("finish_reason") or finish_reason
                    changed = False
                    rc = delta.get("reasoning_content") or delta.get("reasoning")
                    if rc:
                        reasoning += rc
                        changed = True
                    c = delta.get("content")
                    if c:
                        content += c
                        changed = True
                    for tc in delta.get("tool_calls") or []:
                        idx = tc.get("index", 0)
                        while len(tool_calls) <= idx:
                            tool_calls.append({
                                "id": None, "type": "function",
                                "function": {"name": None, "arguments": ""},
                            })
                        entry = tool_calls[idx]
                        if tc.get("id"):
                            entry["id"] = tc["id"]
                        fn = tc.get("function") or {}
                        if fn.get("name"):
                            entry["function"]["name"] = fn["name"]
                        if fn.get("arguments"):
                            entry["function"]["arguments"] += fn["arguments"]
                        changed = True
                    if changed:
                        yield {
                            "type": "token",
                            "content": content,
                            "reasoning_content": reasoning,
                            "tool_calls": [dict(tc) for tc in tool_calls],
                        }
        except httpx.TimeoutException:
            logger.warning(
                "llmgw.real.openai.stream.timeout",
                tenant_id=tenant_id,
                model=self.model,
            )
            yield self._done_event(_stub_response(self.model, messages))
            return
        except httpx.HTTPError as e:
            logger.warning(
                "llmgw.real.openai.stream.error",
                tenant_id=tenant_id,
                model=self.model,
                error=str(e),
            )
            yield self._done_event(_stub_response(self.model, messages))
            return

        yield {
            "type": "done",
            "content": content,
            "reasoning_content": reasoning,
            "tool_calls": [dict(tc) for tc in tool_calls],
            "finish_reason": finish_reason,
            "usage": usage,
        }

    @staticmethod
    def _done_event(stub: ChatResponse) -> dict[str, Any]:
        """Build a ``done`` event for the stub-fallback path."""
        return {
            "type": "done",
            "content": stub.content,
            "reasoning_content": "",
            "tool_calls": [],
            "finish_reason": stub.finish_reason,
            "usage": stub.usage,
        }

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
