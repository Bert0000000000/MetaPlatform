"""SaaS HTTP API 控制面客户端。

硬规则 #4:必须经 mate-clients ACL。Bearer + tenantHeader 由 caller 注入。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True, slots=True)
class MarketplaceAuth:
    bearer: str
    tenant_id: str | None = None

    def headers(self) -> dict[str, str]:
        h: dict[str, str] = {"Authorization": f"Bearer {self.bearer}"}
        if self.tenant_id:
            h["X-Tenant-Id"] = self.tenant_id
        return h


class MarketplaceClient:
    """调用公有 SaaS marketplace HTTP API。"""

    def __init__(
        self,
        *,
        saas_url: str,
        auth: MarketplaceAuth,
        transport: httpx.AsyncClient | None = None,
    ) -> None:
        self.saas_url = saas_url.rstrip("/")
        self.auth = auth
        self.transport = transport or httpx.AsyncClient(timeout=30)

    async def list_artifacts(
        self,
        *,
        kind: str,
        q: str | None = None,
        tag: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "kind": kind,
            "page": page,
            "page_size": page_size,
        }
        if q:
            params["q"] = q
        if tag:
            params["tag"] = tag
        resp = await self.transport.get(
            f"{self.saas_url}/v1/artifacts",
            params=params,
            headers=self.auth.headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def get_artifact(
        self, *, kind: str, artifact_id: str
    ) -> dict[str, Any]:
        resp = await self.transport.get(
            f"{self.saas_url}/v1/artifacts/{kind}/{artifact_id}",
            headers=self.auth.headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def check_license(
        self, *, sku: str, license_key: str, instance_fingerprint: str
    ) -> dict[str, Any]:
        resp = await self.transport.post(
            f"{self.saas_url}/v1/license/check",
            json={
                "sku": sku,
                "license_key": license_key,
                "instance_fingerprint": instance_fingerprint,
            },
            headers=self.auth.headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def activate_license(self, *, license_key: str) -> dict[str, Any]:
        resp = await self.transport.post(
            f"{self.saas_url}/v1/license/activate",
            json={"license_key": license_key},
            headers=self.auth.headers(),
        )
        resp.raise_for_status()
        return resp.json()