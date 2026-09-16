"""ont v2 agent-tools 的异步 ACL 客户端（硬规则 #4）。

**为什么带"发起用户的 token"而不是服务身份**：本体是租户数据面，它的
``AuthMiddleware`` 从 **token 的 tenant claim** 解析租户，服务身份签发的
client_credentials token **不带 tenant**，会被本体直接拒（实测 401）。
而 ADR-0066 §3.3 的不变量本就写着「权限包络的链根是**发起用户**，不是父
agent，也不是服务身份」——所以代用户行事时透传用户 token 是**正确**做法，
不只是绕过限制的权宜之计。

**只读 + 提议**：本客户端故意**不实现** confirm / reject / execute。写操作
只能走到 ``propose_*``，落库与否由人在 proposal 通道决定（ADR-0044）。
"""

from __future__ import annotations

from typing import Any

import httpx


class OntAgentToolsError(RuntimeError):
    """ont 调用失败（传输 / 非 2xx / 反序列化）。"""

    def __init__(self, message: str, *, status: int = 0, body: Any = None) -> None:
        self.status = status
        self.body = body
        super().__init__(message)


class OntAgentToolsClient:
    """``mate-tech-ont`` v2 的 agent 工具面（异步）。"""

    def __init__(
        self,
        base_url: str = "http://localhost:8007",
        *,
        token: str = "",
        tenant_id: str = "",
        timeout: float = 60.0,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._tenant_id = tenant_id
        self._token = token
        self._client = httpx.AsyncClient(timeout=timeout)

    def _headers(self) -> dict[str, str]:
        headers = {"X-Tenant-Id": self._tenant_id} if self._tenant_id else {}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    async def _request(
        self, method: str, path: str, *, json: Any = None, params: dict[str, Any] | None = None
    ) -> Any:
        try:
            resp = await self._client.request(
                method, f"{self._base}{path}", json=json, params=params, headers=self._headers()
            )
        except httpx.HTTPError as exc:
            raise OntAgentToolsError(f"ont transport error: {exc}") from exc
        if resp.status_code >= 300:
            try:
                body: Any = resp.json()
            except ValueError:
                body = resp.text
            raise OntAgentToolsError(
                f"ont {method} {path} returned {resp.status_code}",
                status=resp.status_code,
                body=body,
            )
        if not resp.content:
            return {}
        return resp.json()

    # ── 读 ────────────────────────────────────────────────────────────
    async def list_classes(self, limit: int = 200, offset: int = 0) -> Any:
        return await self._request(
            "GET", "/api/v1/ont/v2/object-types", params={"limit": limit, "offset": offset}
        )

    async def list_agent_tools(self, markings: str = "") -> Any:
        return await self._request(
            "GET", "/api/v1/ont/v2/agent-tools", params={"markings": markings} if markings else None
        )

    async def inspect_class(self, class_rid: str) -> Any:
        return await self._request("GET", f"/api/v1/ont/v2/classes/{class_rid}/inspect")

    async def object_query(self, payload: dict[str, Any]) -> Any:
        return await self._request("POST", "/api/v1/ont/v2/object-query", json=payload)

    # ── 写：只到 proposal 为止 ────────────────────────────────────────
    async def propose_instance(
        self, class_rid: str, props: dict[str, Any], impact_summary: str = ""
    ) -> Any:
        return await self._request(
            "POST",
            f"/api/v1/ont/v2/classes/{class_rid}/propose-instance",
            json={"props": props, "impact_summary": impact_summary},
        )

    async def propose_model_type(self, type_def: dict[str, Any], impact_summary: str = "") -> Any:
        return await self._request(
            "POST",
            "/api/v1/ont/v2/object-types/propose",
            json={"type_def": type_def, "impact_summary": impact_summary},
        )

    async def aclose(self) -> None:
        await self._client.aclose()


__all__ = ["OntAgentToolsClient", "OntAgentToolsError"]
