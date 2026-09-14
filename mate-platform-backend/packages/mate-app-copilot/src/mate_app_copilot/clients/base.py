"""mate_app_copilot.clients.base — outbound client base with BearerAuth.

Provides typed client wrappers for copilot → llmgw / kb / ontology /
a2a cross-service calls. Each client injects `Authorization: Bearer`
+ `X-Tenant-Id` via `OutgoingAuthMiddleware`.

P2-W4 adds real call methods (embeddings, chat, generate_sql) that
go through `httpx.Client(auth=...)`. The actual transport is the
stub_provider for the in-process / single-binary deployment; the
same call sites will switch to llmgw over HTTP in v3.1.

三大原理 #3（AI 输出 = proposal，用户确认后由 ActionType 落库）：
`ont_apply_action` 是 copilot → kernel 的唯一合法写桥，指向契约路径
POST /api/v1/ont/v2/action-types/{rid}/apply。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from mate_clients.security.bearer import BearerAuth
from mate_clients.security.outgoing import OutgoingAuthMiddleware


@dataclass(frozen=True)
class AsyncCopilotClient:
    """Base config for copilot outbound calls.

    Holds the shared BearerAuth instance and service base URLs.
    The `provider` attribute points at a module exposing
    embeddings / chat / generate_sql — currently the in-process
    `mate_app_copilot.llm.stub_provider`. P2-W5 / v3.1 will
    swap it for an httpx-based remote llmgw adapter.
    """

    base_url: str
    auth: BearerAuth
    provider: Any
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
        for name in ("embeddings", "chat", "generate_sql"):
            if not hasattr(self.provider, name):
                raise ValueError(f"provider {self.provider!r} missing {name!r} method")

    def _middleware(self, tenant_id: str) -> OutgoingAuthMiddleware:
        """Build an httpx auth middleware for a specific tenant."""
        return OutgoingAuthMiddleware(self.auth, tenant_id=tenant_id)

    def llmgw_url(self) -> str:
        return f"{self.base_url}/api/v1/llmgw"

    def kb_url(self) -> str:
        return f"{self.base_url}/api/v1/kb"

    def ont_url(self) -> str:
        return f"{self.base_url}/api/v1/ont"

    def a2a_url(self) -> str:
        return f"{self.base_url}/api/v1/a2a"

    def dw_url(self) -> str:
        """Digital Workforce 域主数据 endpoint。

        GOVERN-11 P0：match_employees 必须查 dw 主数据，禁止 copilot 内部
        employee 影子表。路径与 dw.yaml operationId=dwGetDwEmployees 一致。
        """
        return f"{self.base_url}/api/v1/dw"

    # --- Real call methods (P2-W4) -----------------------------------------
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts via the configured LLM provider."""
        return self.provider.embeddings(texts)

    def chat(self, messages: list[dict]) -> str:
        """Run a chat completion via the configured LLM provider."""
        return self.provider.chat(messages)

    def generate_sql(self, nl_prompt: str, tables: list[str]) -> str:
        """Generate SQL from a natural-language prompt."""
        return self.provider.generate_sql(nl_prompt, tables)

    # --- Ontology bridge (三大原理 #3) --------------------------------------
    async def ont_apply_action(
        self,
        rid: str,
        tenant_id: str,
        parameters: dict[str, Any] | None = None,
        target_iid: str = "",
        provenance: dict[str, Any] | None = None,
        fallback_token: str | None = None,
    ) -> dict[str, Any]:
        """Apply an ActionType via the kernel — the only legal write path.

        POST /api/v1/ont/v2/action-types/{rid}/apply through the gateway,
        carrying BearerAuth + X-Tenant-Id (13 硬规则 #4 ACL client).
        When ``fallback_token`` is given the service-identity fetch is
        skipped and the caller's inbound user token is passed through
        (dev mode where the keycloak client secret is a stub). Raises
        on non-2xx so callers can fall back to emit-only.
        """
        import httpx

        url = f"{self.ont_url()}/v2/action-types/{rid.replace('/', '%2F')}/apply"
        payload: dict[str, Any] = {
            "parameters": parameters or {},
            "target_iid": target_iid,
        }
        if provenance:
            payload["provenance"] = provenance
        if fallback_token:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {fallback_token}",
                        "X-Tenant-Id": tenant_id,
                    },
                )
        else:
            async with httpx.AsyncClient(
                auth=self._middleware(tenant_id),
                timeout=self.timeout_seconds,
            ) as client:
                resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()

    async def ont_propose_action(
        self,
        rid: str,
        tenant_id: str,
        parameters: dict[str, Any] | None = None,
        target_iid: str = "",
        fallback_token: str | None = None,
    ) -> dict[str, Any]:
        """Create an action proposal; execution remains human-confirmed."""
        import httpx

        url = f"{self.ont_url()}/v2/action-types/{rid.replace('/', '%2F')}/propose"
        payload = {
            "parameters": parameters or {},
            "target_iid": target_iid,
            "impact_summary": "Copilot requested a governed ActionType execution.",
        }
        if fallback_token:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {fallback_token}",
                        "X-Tenant-Id": tenant_id,
                    },
                )
        else:
            async with httpx.AsyncClient(
                auth=self._middleware(tenant_id),
                timeout=self.timeout_seconds,
            ) as client:
                resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()

    # --- AI model registry (IAM ai_model 表，经 gateway) ----------------------
    async def list_ai_models(
        self,
        tenant_id: str,
        fallback_token: str | None = None,
    ) -> list[dict[str, Any]]:
        """GET /api/v1/admin/ai/models through the gateway → IAM 模型注册表。

        返回 [{id, provider, model_id, display_name, modality, enabled}]；
        非 2xx 抛异常，调用方回退到 in_memory seed。
        """
        import httpx

        url = f"{self.base_url}/api/v1/admin/ai/models"
        headers = {"X-Tenant-Id": tenant_id}
        if fallback_token:
            headers["Authorization"] = f"Bearer {fallback_token}"
        async with httpx.AsyncClient(
            auth=self._middleware(tenant_id) if not fallback_token else None,
            timeout=self.timeout_seconds,
        ) as client:
            resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        body = resp.json()
        # IAM 响应信封 {code, message, data: {items, total}}
        data = body.get("data", body)
        items = data.get("items", []) if isinstance(data, dict) else []
        return [dict(i) for i in items]

    # --- AI Provider 配置（IAM ai.provider.*，经 gateway） --------------------
    async def get_provider_config(
        self,
        tenant_id: str,
        provider_id: str,
        fallback_token: str | None = None,
    ) -> dict[str, str]:
        """GET /api/v1/admin/configs → 取该 provider 的 base_url + api_key。

        返回 {base_url, api_key, default_model}（缺失字段为空串）。
        reveal=1：copilot 以服务身份读取敏感项（api_key）真实值；
        IAM 对人工管理员会话默认掩码返回。
        """
        import httpx
        import os as _os

        # ARK key 托管取数通道：service-read 以服务共享密钥守门，返回
        # ai.provider.* 真实值（服务 client 无 PLATFORM_ADMIN role，
        # 常规 admin 读取过不了 require_admin；用户 token 只能拿掩码）。
        service_secret = _os.getenv("SERVICE_CLIENT_SECRET", "")
        if service_secret:
            # 租户进 query 参数；不带 X-Tenant-Id 头（服务 token 无租户
            # claim，header 冲突会触发租户绑定守卫 403）
            url = (
                f"{self.base_url}/api/v1/admin/configs/service-read"
                f"?prefix=ai.provider.&tenant={tenant_id}"
            )
            headers = {"X-Service-Secret": service_secret}
            # 服务 token 直连（不注入 X-Tenant-Id 的 OutgoingAuthMiddleware）
            try:
                headers["Authorization"] = f"Bearer {self.auth.token()}"
            except Exception:
                pass
        else:
            url = f"{self.base_url}/api/v1/admin/configs?pageSize=200"
            headers = {"X-Tenant-Id": tenant_id}
            if fallback_token:
                headers["Authorization"] = f"Bearer {fallback_token}"
        async with httpx.AsyncClient(
            auth=self._middleware(tenant_id) if (not fallback_token and not service_secret) else None,
            timeout=self.timeout_seconds,
        ) as client:
            resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        body = resp.json()
        if service_secret:
            flat: dict[str, str] = dict(body.get("data", {}) or {})
        else:
            data = body.get("data", body)
            items = data.get("items", []) if isinstance(data, dict) else []
            flat = {
                str(c.get("key", "")): str(c.get("value") or "") for c in items
            }
        # default_active 间接寻址（生产 ARK key 正式托管）：
        #   调用方历史上一律问 "custom"；当后台把 default_active 指向
        #   另一个已配置好（base_url 非空且 key 就绪）的 OpenAI 兼容
        #   provider（如 ark / custom_*）时，自动改读该 provider 的配置。
        #   目标未配置完整时不切换，保持 legacy "custom" 行为。
        if provider_id == "custom":
            active = flat.get("ai.provider.default_active", "")
            if (
                active
                and active not in ("custom", "disabled")
                and flat.get(f"ai.provider.{active}.base_url", "")
                and (
                    flat.get(f"ai.provider.{active}.api_key", "")
                    or active == "ollama"
                )
            ):
                provider_id = active
        result: dict[str, str] = {"provider_id": provider_id}
        prefix = f"ai.provider.{provider_id}."
        for key, val in flat.items():
            if not key.startswith(prefix):
                continue
            suffix = key[len(prefix) :]
            if suffix == "base_url":
                result["base_url"] = val
            elif suffix == "api_key":
                # 掩码值（非 reveal 读取）不是真实 key —— 丢弃，走无 key 降级
                result["api_key"] = "" if val.strip() in ("***", "********") else val
            elif suffix == "default_model":
                result["default_model"] = val
        return result

    # --- dw 域主数据（GOVERN-11 P0：消除 copilot employee 影子表） ----------
    async def list_dw_employees(
        self,
        tenant_id: str,
        keyword: str = "",
        page: int = 1,
        size: int = 100,
        fallback_token: str | None = None,
    ) -> list[dict[str, Any]]:
        """GET /api/v1/dw/employees → dw 域主数据。

        候选池由 dw 域主数据驱动，copilot 不再维护 employee 影子表。
        返回 [{employeeId, name, code, roleCategory, roleIdentity, status, capability}]。
        非 2xx 抛异常，调用方回退到 in_memory seed。
        """
        import httpx

        params: dict[str, Any] = {"page": page, "size": size}
        if keyword:
            params["keyword"] = keyword
        headers = {"X-Tenant-Id": tenant_id}
        if fallback_token:
            headers["Authorization"] = f"Bearer {fallback_token}"
        async with httpx.AsyncClient(
            auth=self._middleware(tenant_id) if not fallback_token else None,
            timeout=self.timeout_seconds,
        ) as client:
            resp = await client.get(
                f"{self.dw_url()}/employees",
                params=params,
                headers=headers,
            )
        resp.raise_for_status()
        body = resp.json()
        data = body.get("data", body)
        items = data.get("items", []) if isinstance(data, dict) else []
        return [dict(i) for i in items]
