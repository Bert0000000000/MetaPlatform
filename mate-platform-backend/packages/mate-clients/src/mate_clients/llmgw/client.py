"""mate_clients.llmgw — LLM 网关的 ACL 客户端（硬规则 #4）。

业务代码不得裸调 ``httpx``；到 llmgw 的每一次调用都要带 Bearer + ``X-Tenant-Id``，
这两件事由 :class:`~mate_clients.security.OutgoingAuthMiddleware` 统一注入。
本模块**就是**这条边界，所以它是允许构造 ``httpx.AsyncClient`` 的地方
（与 ``mate_app_copilot.clients.llmgw_stream`` 同理）。
"""

from __future__ import annotations

from typing import Any

import httpx

from mate_clients.security import OutgoingAuthMiddleware


class LlmgwError(RuntimeError):
    """llmgw 调用失败（传输 / 状态码 / 反序列化）。"""


class LlmgwClient:
    """``mate-tech-llmgw`` 的 chat 面（OpenAI 兼容语义）。"""

    DEFAULT_URL = "http://localhost:8008"

    def __init__(
        self,
        base_url: str | None = None,
        *,
        timeout: float = 120.0,
        auth: Any = None,  # BearerAuth / ServiceIdentity（需有 .token()）
        tenant_id: str = "",
    ) -> None:
        self.base_url = (base_url or self.DEFAULT_URL).rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout)
        self._auth = auth
        self._tenant_id = tenant_id
        if auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)

    def set_tenant(self, tenant_id: str) -> None:
        self._tenant_id = tenant_id
        if self._auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    async def chat_with_tools(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        provider: str = "openai",
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """一轮带函数调用的对话。

        返回 ``{"content", "model", "finish_reason", "usage", "tool_calls": [...]}``。
        """
        body: dict[str, Any] = {
            "provider": provider,
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "tenant_id": self._tenant_id,
        }
        if tools:
            body["tools"] = tools
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if base_url:
            body["base_url"] = base_url
        if api_key:
            body["api_key"] = api_key
        return await self._post("/api/v1/llmgw/chat/real", body)

    async def chat_completion(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        provider: str = "openai",
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """无工具的普通补全。"""
        body: dict[str, Any] = {
            "provider": provider,
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "tenant_id": self._tenant_id,
        }
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if base_url:
            body["base_url"] = base_url
        if api_key:
            body["api_key"] = api_key
        return await self._post("/api/v1/llmgw/chat/real", body)

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        try:
            resp = await self._client.post(f"{self.base_url}{path}", json=body)
        except httpx.HTTPError as exc:
            raise LlmgwError(f"llmgw transport error: {exc}") from exc
        if resp.status_code != 200:
            raise LlmgwError(f"llmgw returned {resp.status_code}: {resp.text[:200]}")
        try:
            return resp.json()
        except ValueError as exc:
            raise LlmgwError(f"llmgw body is not JSON: {exc}") from exc

    async def aclose(self) -> None:
        await self._client.aclose()


__all__ = ["LlmgwClient", "LlmgwError"]
