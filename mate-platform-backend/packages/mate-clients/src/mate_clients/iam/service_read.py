"""IAM 配置的机器取数通道（service-read）。

llmgw 只有在请求里带上租户的 ``base_url`` / ``api_key`` 时才会真的去调上游；
不带就落到 ``stub-fallback``（回显输入）。这两项是敏感配置，人工管理员会话
读到的是掩码，只有服务身份走 ``/api/v1/admin/configs/service-read`` 才拿得到真值。

本模块就是那条出站边界（硬规则 #4）：所有调用都带 ``X-Service-Secret``，
不走内部 Bearer 中间件——服务 token 没有 tenant claim，再叠 ``X-Tenant-Id``
会触发租户绑定守卫 403，所以租户改走 query 参数。
"""

from __future__ import annotations

from typing import Any

import httpx


class ProviderConfigError(RuntimeError):
    """取不到 provider 配置。"""


class IamServiceReadClient:
    """``/api/v1/admin/configs/service-read`` 的客户端。"""

    def __init__(
        self,
        base_url: str = "http://localhost:8100",
        *,
        service_secret: str = "",
        token: str = "",
        timeout: float = 30.0,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._secret = service_secret
        self._token = token
        self._client = httpx.AsyncClient(timeout=timeout)

    def _headers(self) -> dict[str, str]:
        headers = {"X-Service-Secret": self._secret}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    async def get_provider_config(
        self, tenant_id: str, prefix: str = "ai.provider."
    ) -> dict[str, str]:
        """返回当前生效 provider 的 ``{base_url, api_key, default_model, provider_id}``。

        响应形状是 ``{"code":0,"data":{"ai.provider.ark.base_url": "...", ...}}``
        —— 一个**扁平的 key→value** 表，不是列表。取哪一家由
        ``ai.provider.default_active`` 决定（本例为 ``ark``），不能按后缀瞎撞。

        取不到时返回空 dict；调用方据此决定是降级还是报错，本模块不替它决定。
        """
        try:
            resp = await self._client.get(
                f"{self._base}/api/v1/admin/configs/service-read",
                params={"prefix": prefix, "tenant": tenant_id},
                headers=self._headers(),
            )
        except httpx.HTTPError as exc:
            raise ProviderConfigError(f"iam service-read transport error: {exc}") from exc
        if resp.status_code >= 300:
            raise ProviderConfigError(
                f"iam service-read returned {resp.status_code}: {resp.text[:200]}"
            )
        try:
            body: Any = resp.json()
        except ValueError as exc:
            raise ProviderConfigError(f"iam service-read body is not JSON: {exc}") from exc

        flat = self._flatten(body)
        if not flat:
            return {}
        active = flat.get(f"{prefix}default_active", "")
        if not active:
            # 没有 default_active 就退回第一个 enabled=true 的 provider
            for key, value in flat.items():
                if key.endswith(".enabled") and value == "true":
                    active = key[len(prefix) : -len(".enabled")]
                    break
        scoped = f"{prefix}{active}." if active else ""
        return {
            "provider_id": active,
            "base_url": flat.get(f"{scoped}base_url", ""),
            "api_key": flat.get(f"{scoped}api_key", ""),
            "default_model": flat.get(f"{scoped}default_model", ""),
        }

    @staticmethod
    def _flatten(body: Any) -> dict[str, str]:
        if not isinstance(body, dict):
            return {}
        data = body.get("data", body)
        if isinstance(data, dict):
            return {str(k): ("" if v is None else str(v)) for k, v in data.items()}
        if isinstance(data, list):
            out: dict[str, str] = {}
            for item in data:
                if isinstance(item, dict):
                    key = str(item.get("key") or item.get("configKey") or "")
                    value = item.get("value", item.get("configValue"))
                    if key:
                        out[key] = "" if value is None else str(value)
            return out
        return {}

    async def aclose(self) -> None:
        await self._client.aclose()


__all__ = ["IamServiceReadClient", "ProviderConfigError"]
