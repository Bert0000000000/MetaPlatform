"""MP-SAL-01 / MP-SAL-04b / MP-DEDUP-01: ontology 工具（MCP 对外）。

mate-tech-mcp 以静态注册模型暴露代理工具，转发 tech-ont v2：

只读（agent 可调）：
  - ``ont_list_classes``      → GET  /api/v1/ont/v2/agent-tools
  - ``ont_inspect_class``     → GET  /api/v1/ont/v2/classes/{rid}/inspect
  - ``ont_object_query``      → POST /api/v1/ont/v2/object-query

写提议（agent 可调 — 经 proposal 状态机，不直接落库）：
  - ``ont_propose_model_type`` → POST /api/v1/ont/v2/object-types/propose
                                 (kind=model_type; AI 辅助建模)
  - ``ont_propose_instance``  → POST /api/v1/ont/v2/classes/{rid}/propose-instance
                                 (kind=create_instance; 文本 → 字段)
  - ``ont_merge_objects``     → POST /api/v1/ont/v2/object-types/propose-merge
                                 (kind=merge_suggestion; 重映射 source → target)
  - ``ont_preview_proposal``  → GET  /api/v1/ont/v2/proposals/{id}/preview
                                 (MP-SAL-04c pending 渲染)

HITL 边界（``agent_invokable=False``，agent 不能直接调，只能由用户侧调用）：
  - ``ont_confirm_proposal``  → POST /api/v1/ont/v2/proposals/{id}/confirm
  - ``ont_reject_proposal``   → POST /api/v1/ont/v2/proposals/{id}/reject
  - ``ont_execute_proposal``  → POST /api/v1/ont/v2/proposals/{id}/execute

写工具与读工具均走现有 httpx + TECH_ONT_URL 配置；HITL 端点标注
``readonly_by_user=True`` / ``agent_invokable=False`` 双重标记，注册中心
/agent loop 必须按此门禁放行（与 ADR-0044 §2.5 一致）。
"""

from __future__ import annotations

import os
from typing import Any, ClassVar

import httpx
import structlog

logger = structlog.get_logger(__name__)


class OntologyProxyTool:
    """tech-ont v2 代理工具基类。

    元数据扩展（MP-SAL-04 + ADR-0044 §2.5）：
    - ``operation_id``: 对应 tech-ont v2 路由的 operationId（OpenAPI 桥）
    - ``capabilities``: 能力标签列表（注册中心按 capability 检索 + ACL）
    - ``agent_invokable``: 是否允许外部 Agent（FC 调度）直接调用。
                          HITL 边界（confirm/reject/execute）必须为 False，
                          由用户侧端点代理。
    - ``readonly_by_user``: 旧字段，等价于 ``not agent_invokable`` 的反向。
                          保留以兼容 copilot ontology_tools 旧元数据。
    """

    name: str = ""
    description: str = ""
    category: str = "ontology"
    input_schema: ClassVar[dict[str, Any]] = {"type": "object", "properties": {}}

    # 新增元数据（带合理默认值，基类仍可单独使用）
    operation_id: str = ""
    capabilities: ClassVar[tuple[str, ...]] = ()
    agent_invokable: bool = True
    readonly_by_user: bool = False

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 30.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url or os.getenv(
            "TECH_ONT_URL", "http://localhost:8007",
        )
        self._client = client or httpx.AsyncClient(
            base_url=self._base_url, timeout=timeout,
        )

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        resp = await self._client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.post(path, json=payload)
        resp.raise_for_status()
        return resp.json()

    async def aclose(self) -> None:
        await self._client.aclose()


# ─────────────────── 只读三件套（MP-SAL-01，保留原签名）───────────────────


class OntListClassesTool(OntologyProxyTool):
    name = "ont_list_classes"
    description = "列出租户可见的本体对象类型(含 marking),发现可查询的类型"
    operation_id = "ontListV2AgentTools"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "discovery")
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "markings": {
                "type": "string",
                "description": "逗号分隔的 agent markings(可见性过滤,可空)",
            },
        },
    }

    async def __call__(self, markings: str = "") -> list[dict[str, Any]]:
        return await self._get(  # type: ignore[return-value]
            "/api/v1/ont/v2/agent-tools",
            params={"markings": markings} if markings else None,
        )


class OntInspectClassTool(OntologyProxyTool):
    name = "ont_inspect_class"
    description = "查看对象类型元数据: 属性(格式/类型)、可遍历 link、绑定动作"
    operation_id = "ontInspectV2Class"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "schema")
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "class_rid": {"type": "string", "description": "对象类型 rid"},
        },
        "required": ["class_rid"],
    }

    async def __call__(self, class_rid: str) -> dict[str, Any]:
        return await self._get(f"/api/v1/ont/v2/classes/{class_rid}/inspect")


class OntObjectQueryTool(OntologyProxyTool):
    name = "ont_object_query"
    description = (
        "结构化 IR 查询本体对象(filters/aggregation/traversal/multi-key sort),"
        "返回 {kind, rows, result_schema}"
    )
    operation_id = "ontExecuteV2ObjectQuery"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "object-query")
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "source": {"type": "string", "description": "ObjectType rid"},
            "filters": {"type": "array", "items": {"type": "object"}},
            "aggregation": {"type": "object"},
            "traversal": {"type": "array", "items": {"type": "object"}},
            "sort": {"type": "array", "items": {"type": "object"}},
            "paging_limit": {"type": "integer"},
            "paging_offset": {"type": "integer"},
        },
        "required": ["source"],
    }

    async def __call__(self, **kwargs: Any) -> dict[str, Any]:
        payload = {k: v for k, v in kwargs.items() if v is not None}
        return await self._post("/api/v1/ont/v2/object-query", payload)


# ─────────────────── MP-SAL-04b / MP-DEDUP-01: 写提议四件套 ───────────────────


class OntProposeModelTypeTool(OntologyProxyTool):
    """AI 辅助建模提议（kind=model_type，不落库）。

    透传 tech-ont v2 ``POST /object-types/propose``，payload 形如::

        {
          "type_def": { rid, primary_key, properties, display_name, marking },
          "impact_summary": "...",
        }

    返回 ProposalResponse（含 proposal_id / expected_diff / kind=model_type）。
    """

    name = "ont_propose_model_type"
    description = (
        "AI 辅助建模提议（kind=model_type）：AI 根据文本生成 ObjectType 定义，"
        "产出 pending proposal；schema 变更必须人工 confirm 后才会落库。"
    )
    operation_id = "ontProposeV2ObjectType"
    capabilities: ClassVar[tuple[str, ...]] = (
        "ontology.write", "proposal", "model_type",
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "ObjectType 显示名"},
            "slug": {"type": "string", "description": "slug（拼接为 rid）"},
            "domain": {"type": "string", "description": "域 hint（透传到 type_def）"},
            "properties": {
                "type": "array",
                "items": {"type": "object"},
                "description": "Property 列表（rid/type_id/format/...）",
            },
            "primary_key": {
                "type": "array",
                "items": {"type": "string"},
                "description": "主键 slug 列表",
            },
            "impact_summary": {"type": "string", "description": "人类可读的影响摘要"},
        },
        "required": ["name", "slug", "impact_summary"],
    }

    async def __call__(
        self,
        *,
        name: str,
        slug: str,
        impact_summary: str,
        domain: str = "",
        properties: list[dict[str, Any]] | None = None,
        primary_key: list[str] | None = None,
    ) -> dict[str, Any]:
        # 组装完整 ObjectTypeDTO 透传给 tech-ont。rid 由调用方在 type_def 里
        # 显式给出（cross-tenant 校验在 tech-ont 侧做）；这里只负责构造
        # 客户端 → server 的 payload shape。
        type_def: dict[str, Any] = {
            "rid": f"ont.__TENANT__.{slug}.v1",  # 占位，由 tech-ont 注入 tenant
            "primary_key": tuple(primary_key or ["id"]),
            "properties": list(properties or []),
            "display_name": name,
            "interfaces": [],
            "marking": [domain] if domain else [],
        }
        payload = {"type_def": type_def, "impact_summary": impact_summary}
        return await self._post("/api/v1/ont/v2/object-types/propose", payload)


class OntProposeInstanceTool(OntologyProxyTool):
    """文本抽取字段 → 新建实例提议（kind=create_instance，不落库）。

    透传 tech-ont v2 ``POST /classes/{class_rid}/propose-instance``。
    """

    name = "ont_propose_instance"
    description = (
        "从文本抽取的字段提议新建一个本体对象实例（kind=create_instance）。"
        "产出 pending proposal 等用户 confirm 后才落库。"
    )
    operation_id = "ontProposeV2Instance"
    capabilities: ClassVar[tuple[str, ...]] = (
        "ontology.write", "proposal", "create_instance",
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "class_rid": {"type": "string", "description": "目标 ObjectType rid"},
            "fields": {
                "type": "object",
                "description": "字段值 dict（属性 slug → 值）",
            },
            "impact_summary": {"type": "string", "description": "人类可读影响"},
            "expected_diff": {"type": "object", "description": "可选预期 diff"},
        },
        "required": ["class_rid", "fields", "impact_summary"],
    }

    async def __call__(
        self,
        *,
        class_rid: str,
        fields: dict[str, Any],
        impact_summary: str,
        expected_diff: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "props": dict(fields),
            "impact_summary": impact_summary,
        }
        if expected_diff:
            payload["expected_diff"] = expected_diff
        return await self._post(
            f"/api/v1/ont/v2/classes/{class_rid}/propose-instance",
            payload,
        )


class OntMergeObjectsTool(OntologyProxyTool):
    """两个 ObjectType 提议合并（kind=merge_suggestion，不落库）。

    透传 tech-ont v2 ``POST /object-types/propose-merge``。
    """

    name = "ont_merge_objects"
    description = (
        "提议合并两个 ObjectType（kind=merge_suggestion）："
        "source → target 重映射 + 软删 source。"
        "产出 pending proposal，confirm 后 execute 触发真实合并。"
    )
    operation_id = "ontProposeV2ObjectTypeMerge"
    capabilities: ClassVar[tuple[str, ...]] = (
        "ontology.write", "proposal", "merge_suggestion",
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "source_rid": {"type": "string", "description": "被合并的 rid"},
            "target_rid": {"type": "string", "description": "保留的 rid"},
            "mapping": {
                "type": "object",
                "description": "可选 Property slug 映射 (source_prop → target_prop)",
            },
            "similarity": {
                "type": "number",
                "description": "相似度 0-1（透传到 proposal.parameters）",
            },
            "impact_summary": {"type": "string"},
        },
        "required": ["source_rid", "target_rid", "impact_summary"],
    }

    async def __call__(
        self,
        *,
        source_rid: str,
        target_rid: str,
        impact_summary: str,
        mapping: dict[str, str] | None = None,
        similarity: float = 0.0,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "source_rid": source_rid,
            "target_rid": target_rid,
            "similarity": similarity,
            "impact_summary": impact_summary,
            "mapping": dict(mapping or {}),
        }
        return await self._post(
            "/api/v1/ont/v2/object-types/propose-merge", payload,
        )


class OntPreviewProposalTool(OntologyProxyTool):
    """MP-SAL-04c: pending proposal 渲染预览（不落库）。"""

    name = "ont_preview_proposal"
    description = (
        "渲染 pending proposal 的预览（MP-SAL-04c）：返回 kind / action_type / "
        "target_rid / impact_summary / parameters / expected_diff / 额外 kind "
        "specific 字段（properties / merge_mapping / ...）。已 confirm / 已 "
        "apply / 已 reject 的 proposal 返回 409。"
    )
    operation_id = "ontGetV2ProposalPreview"
    capabilities: ClassVar[tuple[str, ...]] = (
        "ontology.read", "proposal", "preview",
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "proposal_id": {"type": "string", "description": "pending proposal id"},
        },
        "required": ["proposal_id"],
    }

    async def __call__(self, proposal_id: str) -> dict[str, Any]:
        return await self._get(f"/api/v1/ont/v2/proposals/{proposal_id}/preview")


# ─────────────────── HITL 边界（agent_invokable=False）───────────────────


class _HitlProposalTool(OntologyProxyTool):
    """HITL 边界工具基类：禁止外部 Agent 直接调用。

    这些端点只能由用户侧（前端"确认 / 拒绝"按钮或 backend 用户路由）触发；
    agent FC 调度若尝试调用将返回 ``PermissionError``（注册中心按
    ``agent_invokable=False`` 拦截）。
    """

    agent_invokable: bool = False
    readonly_by_user: bool = True
    capabilities: ClassVar[tuple[str, ...]] = (
        "ontology.write", "proposal", "hitl",
    )


class OntConfirmProposalTool(_HitlProposalTool):
    """pending → confirmed（用户确认）。

    ⚠ HITL 边界：只有用户侧能调用。Agent 不能绕过 confirm 落库。
    """

    name = "ont_confirm_proposal"
    description = (
        "用户确认 pending proposal（pending → confirmed）。HITL 边界："
        "agent_invokable=False，外部 Agent 直接调用会被注册中心拒绝。"
    )
    operation_id = "ontConfirmV2Proposal"
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "proposal_id": {"type": "string", "description": "proposal id"},
            "confirmed_by": {
                "type": "string",
                "description": "确认人 sub（user id / service principal）",
            },
        },
        "required": ["proposal_id"],
    }

    async def __call__(
        self,
        *,
        proposal_id: str,
        confirmed_by: str = "",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"confirmed_by": confirmed_by}
        return await self._post(
            f"/api/v1/ont/v2/proposals/{proposal_id}/confirm", payload,
        )


class OntRejectProposalTool(_HitlProposalTool):
    """pending → rejected（用户拒绝）。

    ⚠ HITL 边界：只有用户侧能调用。
    """

    name = "ont_reject_proposal"
    description = (
        "用户拒绝 pending proposal（pending → rejected）。HITL 边界："
        "agent_invokable=False，外部 Agent 直接调用会被注册中心拒绝。"
    )
    operation_id = "ontRejectV2Proposal"
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "proposal_id": {"type": "string", "description": "proposal id"},
            "confirmed_by": {
                "type": "string",
                "description": "拒绝人 sub",
            },
        },
        "required": ["proposal_id"],
    }

    async def __call__(
        self,
        *,
        proposal_id: str,
        confirmed_by: str = "",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"confirmed_by": confirmed_by}
        return await self._post(
            f"/api/v1/ont/v2/proposals/{proposal_id}/reject", payload,
        )


class OntExecuteProposalTool(_HitlProposalTool):
    """confirmed → applied（已确认 proposal 落库执行）。

    ⚠ HITL 边界：只有用户侧能调用。Agent 不能跳过 confirm 直接 execute。
    """

    name = "ont_execute_proposal"
    description = (
        "执行已 confirmed 的 proposal（confirmed → applied）。HITL 边界："
        "agent_invokable=False。create_instance → 新建；model_type → upsert "
        "类型；merge_suggestion → 自动触发 merge_object_types。"
    )
    operation_id = "ontExecuteV2Proposal"
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "proposal_id": {"type": "string", "description": "confirmed proposal id"},
        },
        "required": ["proposal_id"],
    }

    async def __call__(self, *, proposal_id: str) -> dict[str, Any]:
        return await self._post(
            f"/api/v1/ont/v2/proposals/{proposal_id}/execute", {},
        )


def build_ontology_proxy_tools() -> tuple[OntologyProxyTool, ...]:
    """工厂：返回所有已注册的 ontology 代理工具。

    顺序：只读三件套 → 写提议四件套 → HITL 三件套（agent 不能直接调）。
    """
    return (
        OntListClassesTool(),
        OntInspectClassTool(),
        OntObjectQueryTool(),
        OntProposeModelTypeTool(),
        OntProposeInstanceTool(),
        OntMergeObjectsTool(),
        OntPreviewProposalTool(),
        # HITL 边界（agent_invokable=False）
        OntConfirmProposalTool(),
        OntRejectProposalTool(),
        OntExecuteProposalTool(),
    )