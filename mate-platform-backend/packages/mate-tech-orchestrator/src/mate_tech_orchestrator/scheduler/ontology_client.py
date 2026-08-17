"""MP-SAL-05: OntologyActionClient —— orchestrator → tech-ont 的本体动作客户端。

让 plan 步骤执行器触达 SAL-01/04/04b 管线：
- propose（action / create_instance / model_type）+ confirm + reject + execute
- ActionType.apply（唯一写入口）
- object-query（IR 查询）
- 流程实例本体化（ensure_process_type + upsert_process_instance —— 编排器
  自身的系统元数据，走管理面直写，非用户业务对象，不经 proposal 闸）

env：ONT_HTTP_BASE（默认 http://localhost:8007）。
鉴权：单例 client，逐调用置换 X-Tenant-Id + 用户 Bearer（token 由
plan_execute / plan_review 端点从请求 ctx 透传）。
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

_BASE = "/api/v1/ont/v2"


class OntologyClientError(RuntimeError):
    """tech-ont 调用失败（网络 / 非 2xx）。"""


class OntologyActionClient:
    """async httpx 客户端；每个方法对应 v2 契约端点。"""

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 20.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base = (base_url or os.getenv("ONT_HTTP_BASE", "http://localhost:8007")).rstrip("/")
        self._client = client or httpx.AsyncClient(
            base_url=self._base, timeout=timeout, headers={"X-Tenant-Id": ""},
        )

    def _tenant(self, tenant_id: str, token: str = "") -> None:
        """per-request 覆盖：tenant 头 + 用户 token（单例 client，逐调用置换）。"""
        self._client.headers["X-Tenant-Id"] = tenant_id
        if token:
            self._client.headers["Authorization"] = f"Bearer {token}"

    async def _post(
        self, tenant_id: str, path: str, payload: dict[str, Any], token: str = "",
    ) -> Any:
        self._tenant(tenant_id, token)
        resp = await self._client.post(f"{_BASE}{path}", json=payload)
        if resp.status_code >= 400:
            raise OntologyClientError(
                f"tech-ont POST {path} -> {resp.status_code}: {resp.text[:300]}"
            )
        return resp.json()

    # ───── 动作管线 ─────

    async def propose_action(
        self, tenant_id: str, action_rid: str, *,
        parameters: dict[str, Any] | None = None,
        target_iid: str = "", impact_summary: str = "",
        expected_diff: dict[str, Any] | None = None,
        token: str = "",
    ) -> dict[str, Any]:
        return await self._post(tenant_id, f"/action-types/{action_rid}/propose", {
            "parameters": parameters or {}, "target_iid": target_iid,
            "impact_summary": impact_summary, "expected_diff": expected_diff or {},
        }, token)

    async def propose_instance(
        self, tenant_id: str, class_rid: str, *,
        props: dict[str, Any] | None = None,
        impact_summary: str = "", token: str = "",
    ) -> dict[str, Any]:
        return await self._post(tenant_id, f"/classes/{class_rid}/propose-instance", {
            "props": props or {}, "impact_summary": impact_summary,
        }, token)

    async def confirm(
        self, tenant_id: str, proposal_id: str,
        confirmed_by: str = "", token: str = "",
    ) -> Any:
        return await self._post(
            tenant_id, f"/proposals/{proposal_id}/confirm",
            {"confirmed_by": confirmed_by}, token,
        )

    async def reject(
        self, tenant_id: str, proposal_id: str,
        confirmed_by: str = "", token: str = "",
    ) -> Any:
        return await self._post(
            tenant_id, f"/proposals/{proposal_id}/reject",
            {"confirmed_by": confirmed_by}, token,
        )

    async def apply(
        self, tenant_id: str, action_rid: str, *,
        parameters: dict[str, Any] | None = None,
        target_iid: str = "", proposal_id: str = "", token: str = "",
    ) -> dict[str, Any]:
        return await self._post(tenant_id, f"/action-types/{action_rid}/apply", {
            "parameters": parameters or {}, "target_iid": target_iid,
            "provenance": {"actor": "orchestrator", "tenant_id": tenant_id,
                           "proposal_id": proposal_id},
        }, token)

    async def execute_proposal(
        self, tenant_id: str, proposal_id: str, token: str = "",
    ) -> dict[str, Any]:
        return await self._post(
            tenant_id, f"/proposals/{proposal_id}/execute", {}, token,
        )

    async def object_query(
        self, tenant_id: str, payload: dict[str, Any], token: str = "",
    ) -> dict[str, Any]:
        return await self._post(tenant_id, "/object-query", payload, token)

    # ───── 流程实例本体化（通道③；管理面直写：编排元数据非业务数据）─────

    _PI_PROPS = (
        ("pi-id", "pi_id", False),
        ("pi-plan-id", "plan_id", True),
        ("pi-status", "status", True),
        ("pi-current-step", "current_step", True),
        ("pi-proposal-id", "proposal_id", True),
        ("pi-updated-at", "updated_at", True),
    )

    async def ensure_process_type(self, tenant_id: str, token: str = "") -> dict[str, Any]:
        props = []
        for slug, title, _nullable in self._PI_PROPS:
            is_pk = slug == "pi-id"
            props.append({
                "rid": f"ont.{tenant_id}.prop.{slug}.v1",
                "type_id": "string", "nullable": not is_pk, "primary_key": is_pk,
                "title": title, "format": "string",
            })
        td = {
            "rid": f"ont.{tenant_id}.obj.process-instance.v1",
            "primary_key": [f"ont.{tenant_id}.prop.pi-id.v1"],
            "properties": props,
            "display_name": "流程实例",
        }
        return await self._post(tenant_id, "/object-types", td, token)

    async def upsert_process_instance(
        self, tenant_id: str, plan_id: str, *,
        status: str, current_step: str = "", proposal_id: str = "",
        token: str = "",
    ) -> dict[str, Any]:
        pi_rid = f"pi-{plan_id[:24]}"

        def _v(slug: str, val: Any) -> dict[str, Any]:
            return {"value": "" if val is None else val, "type": "string"}

        values = {
            "pi-id": pi_rid,
            "pi-plan-id": plan_id,
            "pi-status": status,
            "pi-current-step": current_step or "",
            "pi-proposal-id": proposal_id or "",
            "pi-updated-at": datetime.now(UTC).isoformat(timespec="seconds"),
        }
        return await self._post(tenant_id, "/individuals", {
            "rid": f"ont.{tenant_id}.ind.process-instance.{pi_rid}",
            "class_rid": f"ont.{tenant_id}.obj.process-instance.v1",
            "primary_key": pi_rid,
            "props": {
                f"ont.{tenant_id}.prop.{slug}.v1": _v(slug, val)
                for slug, val in values.items()
            },
        }, token)

    async def aclose(self) -> None:
        await self._client.aclose()
