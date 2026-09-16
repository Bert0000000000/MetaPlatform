"""mate_clients.llmgw — LLM 网关的 ACL 客户端（硬规则 #4）。

业务代码不得裸调 ``httpx``；到 llmgw 的每一次调用都要带 Bearer + ``X-Tenant-Id``，
这两件事由 :class:`~mate_clients.security.OutgoingAuthMiddleware` 统一注入。
本模块**就是**这条边界，所以它是允许构造 ``httpx.AsyncClient`` 的地方
（与 ``mate_app_copilot.clients.llmgw_stream`` 同理）。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from mate_clients.security import OutgoingAuthMiddleware

#: 惰性取回租户的上游 provider 配置（base_url / api_key / default_model）
ProviderConfigResolver = Callable[[], Awaitable[dict[str, str]]]


class LlmgwError(RuntimeError):
    """llmgw 调用失败（传输 / 状态码 / 反序列化）。"""


class LlmgwClient:
    """``mate-tech-llmgw`` 的 chat 面（OpenAI 兼容语义）。

    **为什么需要 provider 配置**：llmgw 只有在请求里带上租户的
    ``base_url`` / ``api_key`` 时才会真的去调上游；不带就落到
    ``stub-fallback``（把输入原样回显）。回显会让"员工真实执行"变成
    一句空话，所以生产装配必须把 provider 配置喂进来。
    """

    DEFAULT_URL = "http://localhost:8008"

    def __init__(
        self,
        base_url: str | None = None,
        *,
        timeout: float = 120.0,
        auth: Any = None,  # BearerAuth / ServiceIdentity（需有 .token()）
        tenant_id: str = "",
        user_token: str = "",
        provider_config: ProviderConfigResolver | None = None,
    ) -> None:
        self.base_url = (base_url or self.DEFAULT_URL).rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout)
        self._auth = auth
        self._tenant_id = tenant_id
        self._user_token = user_token
        self._provider_config = provider_config
        self._provider: dict[str, str] | None = None
        if auth is not None and tenant_id and not user_token:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)

    def _headers(self) -> dict[str, str]:
        """带发起用户令牌时手工注入，不走服务身份的中间件。

        原因（实测）：服务身份 token 的 ``iss`` 取决于换发它的 Keycloak 地址，
        与 llmgw 校验的地址不一致时会被判 "Invalid issuer" 401；而发起用户的
        登录令牌本来就是网关签发的，llmgw 认。ADR-0066 §3.3 也要求链根是用户。
        """
        if not self._user_token:
            return {}
        headers = {"Authorization": f"Bearer {self._user_token}"}
        if self._tenant_id:
            headers["X-Tenant-Id"] = self._tenant_id
        return headers

    def set_tenant(self, tenant_id: str) -> None:
        self._tenant_id = tenant_id
        self._provider = None
        if self._auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    async def _resolved_provider(self) -> dict[str, str]:
        """首次调用时取一次租户的 provider 配置，本次连接内复用。"""
        if self._provider is None:
            if self._provider_config is None:
                self._provider = {}
            else:
                try:
                    self._provider = await self._provider_config()
                except Exception:
                    # 取不到就退回网关默认（会走 stub-fallback）；不让配置面
                    # 的故障把整轮员工执行打死。
                    self._provider = {}
        return self._provider

    async def chat_with_tools(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        provider: str | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """一轮带函数调用的对话。

        返回 ``{"content", "model", "finish_reason", "usage", "tool_calls": [...]}``。
        """
        cfg = await self._resolved_provider()
        resolved_base = base_url or cfg.get("base_url") or None
        resolved_key = api_key or cfg.get("api_key") or None
        body: dict[str, Any] = {
            "provider": provider or ("custom" if resolved_base else "openai"),
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "tenant_id": self._tenant_id,
        }
        if tools:
            body["tools"] = tools
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if resolved_base:
            body["base_url"] = resolved_base
        if resolved_key:
            body["api_key"] = resolved_key
        return await self._post("/api/v1/llmgw/chat/real", body)

    async def chat_completion(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        provider: str | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """无工具的普通补全。"""
        cfg = await self._resolved_provider()
        resolved_base = base_url or cfg.get("base_url") or None
        resolved_key = api_key or cfg.get("api_key") or None
        body: dict[str, Any] = {
            "provider": provider or ("custom" if resolved_base else "openai"),
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "tenant_id": self._tenant_id,
        }
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if resolved_base:
            body["base_url"] = resolved_base
        if resolved_key:
            body["api_key"] = resolved_key
        return await self._post("/api/v1/llmgw/chat/real", body)

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        try:
            resp = await self._client.post(
                f"{self.base_url}{path}", json=body, headers=self._headers() or None
            )
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
