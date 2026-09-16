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

from ..caller_context import current_caller

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
        # 服务身份（lazy）：TECH_ONT_TOKEN 兼容两种语义 ——
        #   1) client_credentials secret（默认；运行时向 Keycloak 换 JWT）
        #   2) 已签发的 Bearer JWT（以 "eyJ" 开头直接透传）
        # 出站 401 时自动刷新一次（Keycloak token 过期自愈）。
        self._auth_secret = os.getenv("TECH_ONT_TOKEN", "")
        self._auth_client_id = os.getenv("TECH_ONT_CLIENT_ID", "metaplatform-backend")
        self._kc_url = os.getenv("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
        self._kc_realm = os.getenv("KEYCLOAK_REALM", "metaplatform")
        self._bearer: str = ""
        self._bearer_exp: float = 0.0
        # env 兼容两套命名：TECH_ONT_URL（历史）与 ONTOLOGY_URL（compose 现行）
        self._base_url = (
            base_url
            or os.getenv("TECH_ONT_URL")
            or os.getenv("ONTOLOGY_URL")
            or "http://localhost:8007"
        )
        # dev/staging 兜底：无调用方上下文时（stdio / 内部桥）用服务身份 + 静态
        # 租户。有调用方时逐请求透传其 token 与租户（1.1 task 1c）。
        self._tenant = os.getenv("TECH_ONT_TENANT", "tenant-default")
        self._client = client or httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
        )

    async def _ensure_bearer(self) -> str:
        """client_credentials → JWT（带 60s 提前刷新；失败回退空 = 匿名）。"""
        import time as _time

        if not self._auth_secret:
            return ""
        if self._auth_secret.startswith("eyJ"):
            return self._auth_secret
        if self._bearer and _time.time() < self._bearer_exp - 60:
            return self._bearer
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                resp = await c.post(
                    f"{self._kc_url}/realms/{self._kc_realm}/protocol/openid-connect/token",
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self._auth_client_id,
                        "client_secret": self._auth_secret,
                        "scope": "openid",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                self._bearer = str(data["access_token"])
                self._bearer_exp = _time.time() + float(data.get("expires_in", 300))
        except Exception as exc:
            logger.warning("mcp.ont_proxy.token_failed", error=str(exc))
            self._bearer = ""
        return self._bearer

    async def _outbound_headers(self) -> dict[str, str]:
        """Auth + tenant for the outbound call.

        1.1 task 1c: when a caller is bound to this request, go out **as that
        caller** — their bearer token and their tenant. The service-identity
        ``client_credentials`` token carries no ``tenant`` claim, so the
        ontology engine's tenant guard rejects it (measured: 403).

        An ``sk-mcp-*`` client key is a MCP-centre-only credential that no
        other service can verify; the surfaces therefore bind an *empty*
        token for those callers, and the hop falls back to the service
        identity while still naming the caller's tenant in ``X-Tenant-Id``.
        """
        caller = current_caller()
        if caller is not None:
            headers = {"X-Tenant-Id": caller.tenant_id}
            token = caller.bearer_token or await self._ensure_bearer()
            if token:
                headers["Authorization"] = f"Bearer {token}"
            return headers
        headers = {"X-Tenant-Id": self._tenant}
        token = await self._ensure_bearer()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        resp = await self._client.get(path, params=params, headers=await self._outbound_headers())
        resp.raise_for_status()
        return resp.json()

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.post(path, json=payload, headers=await self._outbound_headers())
        resp.raise_for_status()
        return resp.json()

    async def aclose(self) -> None:
        await self._client.aclose()


# ─────────────────── 只读三件套（MP-SAL-01，保留原签名）───────────────────


class OntListClassesTool(OntologyProxyTool):
    name = "ont_list_classes"
    description = (
        "列出租户可见的本体对象类型的**清单**（rid + 名称）。"
        "这是发现可查询类型的唯一入口：**必须先调它，并从返回里原样挑 rid**，"
        "禁止凭业务名词自己拼造 rid（拼出来的 rid 一律 404）。"
    )
    operation_id = "ontListV2ObjectTypes"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "discovery")
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "description": "返回条数上限(默认 100)"},
        },
    }

    async def __call__(self, limit: int = 100) -> dict[str, Any]:
        # 2026-09-16 修复：原先打 /agent-tools —— 那个端点回的是**工具**清单
        # （query_<slug> / search_objects …，字段是 name/class_rid），没有 rid，
        # 于是下面的裁剪恒为 0 条，「列类型」这个工具实际一直是空手而归。
        # 列对象类型要走 /object-types（回 ObjectTypeResponse，带 rid）。
        raw = await self._get(
            "/api/v1/ont/v2/object-types",
            params={"limit": limit},
        )
        return _compact_classes(raw)


def _compact_classes(raw: Any) -> dict[str, Any]:
    """把对象类型的完整定义压成「rid + 名称」清单。

    本体返回的每个类型都带全部属性定义（几十个字段）。两件事都实测过：

    * 直接回原样 → 模型翻不到「订单」，**开始自己拼 rid**，然后 404；
    * 连属性名一起回 → 47 个类型加起来超过单条工具结果的裁剪上限，
      模型只看得到前几个类型，实测因此**挑错了订单类**。

    所以清单只回 rid + 名称；要属性再调 ``ont_inspect_class``。
    （1.1 task 1c 之前这段逻辑在 agent-team 的直连旁路里；本体工具面收回
    MCP 总线后，裁剪必须跟着搬回来，否则 1.0 的教训就丢了。）
    """
    items = raw if isinstance(raw, list) else (raw or {}).get("items", [])
    classes = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        rid = str(item.get("rid") or "")
        if not rid:
            continue
        classes.append(
            {
                "rid": rid,
                "name": rid.rsplit(".", 2)[-2] if "." in rid else rid,
            }
        )
    return {
        "count": len(classes),
        "classes": classes,
        "hint": "要看某个类型的属性与链接，用 ont_inspect_class(class_rid=…)。",
    }


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
        "ontology.write",
        "proposal",
        "model_type",
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
        client_provenance: dict[str, Any] | None = None,
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
        payload = {
            "type_def": type_def,
            "impact_summary": impact_summary,
            # ONT-PROV-01：外部 AI 客户端提案自动溯源
            "provenance": {
                "source": "ai",
                "client": "mcp",
                **(client_provenance or {}),
            },
        }
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
        "ontology.write",
        "proposal",
        "create_instance",
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
            "client_provenance": {
                "type": "object",
                "description": "溯源补充（model/agent 标识等；source=ai 由平台强制）",
            },
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
        client_provenance: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "props": dict(fields),
            "impact_summary": impact_summary,
            # ONT-PROV-01：外部 AI 客户端提案自动溯源（source=ai 恒有；
            # client 侧可补充 model/agent 标识，显式键优先）
            "provenance": {
                "source": "ai",
                "client": "mcp",
                **(client_provenance or {}),
            },
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
        "ontology.write",
        "proposal",
        "merge_suggestion",
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
            "/api/v1/ont/v2/object-types/propose-merge",
            payload,
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
        "ontology.read",
        "proposal",
        "preview",
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
        "ontology.write",
        "proposal",
        "hitl",
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
            f"/api/v1/ont/v2/proposals/{proposal_id}/confirm",
            payload,
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
            f"/api/v1/ont/v2/proposals/{proposal_id}/reject",
            payload,
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
            f"/api/v1/ont/v2/proposals/{proposal_id}/execute",
            {},
        )


# ─────────────────── 2026-09-14 增量：外部 AI 客户端能力面 ───────────────────


class OntListIndividualsTool(OntologyProxyTool):
    """实例浏览（EXP-01 多态）：class_rid 接受 ObjectType 或 Interface rid。

    Interface 源 = 实现类型 + 各自后代（与查询路径同语义）；响应含
    provenance（AI 落库实例可识别来源与置信度）。
    """

    name = "ont_list_individuals"
    description = (
        "列出本体对象实例。class_rid 支持 ObjectType rid（精确匹配）或 "
        "Interface rid（多态：实现类型+后代的实例一起返回）。"
        "返回含 provenance（source=ai 的实例可溯源）。"
    )
    operation_id = "ontListV2Individuals"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "instances", "polymorphic")

    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "class_rid": {
                "type": "string",
                "description": "ObjectType rid 或 Interface rid（多态源）",
            },
        },
        "required": ["class_rid"],
    }

    async def __call__(self, *, class_rid: str) -> list[dict[str, Any]]:
        return await self._get(  # type: ignore[return-value]
            "/api/v1/ont/v2/individuals",
            params={"class_rid": class_rid},
        )


class OntSearchObjectsTool(OntologyProxyTool):
    """语义搜索（向量检索实例）。"""

    name = "ont_search_objects"
    description = "自然语言语义搜索本体实例（向量检索），返回相似卡片列表。"
    operation_id = "ontSearchV2Objects"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "semantic-search")

    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "自然语言查询"},
            "class_rid": {"type": "string", "description": "限定类型（可选）"},
            "top_k": {"type": "integer", "description": "返回条数（默认 8）"},
        },
        "required": ["text"],
    }

    async def __call__(self, *, text: str, class_rid: str = "", top_k: int = 8) -> Any:
        payload: dict[str, Any] = {"text": text, "top_k": top_k}
        if class_rid:
            payload["class_rid"] = class_rid
        return await self._post("/api/v1/ont/v2/object-search", payload)


class OntValidatePreflightTool(OntologyProxyTool):
    """三闸门干跑自检（schema×SHACL×Axiom）—— 不产提案、不落库。

    外部 AI 客户端在 propose 之前可先自检字段合法性，减少被闸门阻断的
    往返（propose 响应本身也会带完整 preflight 报告）。
    """

    name = "ont_validate_preflight"
    description = (
        "干跑校验实例字段（不产提案）：schema 校验 + SHACL 约束。"
        "返回 {schema: {errors[]}, shacl: {conforms, violations[]}}。"
    )
    operation_id = "ontValidateV2Data"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "validation", "gate")

    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "class_rid": {"type": "string", "description": "目标 ObjectType rid"},
            "fields": {"type": "object", "description": "字段值 dict（slug→值）"},
        },
        "required": ["class_rid", "fields"],
    }

    async def __call__(self, *, class_rid: str, fields: dict[str, Any]) -> dict[str, Any]:
        schema = await self._post(
            "/api/v1/ont/v2/object-types/validate-data",
            {"class_rid": class_rid, "props": dict(fields)},
        )
        try:
            shacl = await self._post(
                "/api/v1/ont/v2/shacl/validate",
                {"target_class": class_rid},
            )
        except Exception:
            shacl = {"conforms": None, "violations": [], "note": "shacl unavailable"}
        return {"schema": schema, "shacl": shacl}


class OntAgentMetricsTool(OntologyProxyTool):
    """AI Agent 回归指标（proposal 接受率基线）。"""

    name = "ont_agent_metrics"
    description = (
        "AI 提案回归指标：总数/状态分布/接受率（accepted=executed+reverted）/"
        "by_actor。外部 Agent 可自省提案质量基线。"
    )
    operation_id = "ontAgentMetricsSummary"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "metrics")

    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "days": {"type": "integer", "description": "时间窗天数（默认 30）"},
        },
    }

    async def __call__(self, *, days: int = 30) -> dict[str, Any]:
        return await self._get(  # type: ignore[return-value]
            "/api/v1/ont/v2/agent-metrics/summary",
            params={"days": days},
        )


class OntListInterfacesTool(OntologyProxyTool):
    """Interface 契约清单（多态查询源发现）。"""

    name = "ont_list_interfaces"
    description = (
        "列出全部 Interface 契约（属性签名 + 实现类型数）。Interface rid 可作为多态查询/浏览源。"
    )
    operation_id = "ontListV2Interfaces"
    capabilities: ClassVar[tuple[str, ...]] = ("ontology.read", "discovery", "interface")

    input_schema: ClassVar[dict[str, Any]] = {"type": "object", "properties": {}}

    async def __call__(self) -> list[dict[str, Any]]:
        return await self._get("/api/v1/ont/v2/interfaces")  # type: ignore[return-value]


def build_ontology_proxy_tools() -> tuple[OntologyProxyTool, ...]:
    """工厂：返回所有已注册的 ontology 代理工具。

    顺序：只读三件套 → 写提议四件套 → HITL 三件套（agent 不能直接调）。
    """
    return (
        OntListClassesTool(),
        OntInspectClassTool(),
        OntObjectQueryTool(),
        # 2026-09-14：外部 AI 客户端能力面（读 + 自检 + 指标）
        OntListIndividualsTool(),
        OntSearchObjectsTool(),
        OntValidatePreflightTool(),
        OntAgentMetricsTool(),
        OntListInterfacesTool(),
        # 写提议（provenance 自动溯源）
        OntProposeModelTypeTool(),
        OntProposeInstanceTool(),
        OntMergeObjectsTool(),
        OntPreviewProposalTool(),
        # HITL 边界（agent_invokable=False）
        OntConfirmProposalTool(),
        OntRejectProposalTool(),
        OntExecuteProposalTool(),
    )
