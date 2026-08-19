"""AGENT-ONT-01: Ontology 数字员工。

7+1 数字员工中的「Ontology 员工」—— 由 SuperAIOrchestrator 在选择 AgentRole.ONTOLOGY 时路由。
职责（kernel 阶段）：
- rule-based ``handle()``：M2/M3 兼容路径，基于正则把「状态=open」翻成 ObjectSet。
- LLM-backed ``handle_message()``：M3+ 主路径，让 LLM 选 action_kind 并 dispatch。
  支持 list / inspect / propose_object_type / propose_instance / merge_suggestion / search，
  所有 schema 变更必经 proposal 状态机。

不依赖外部 LLM SDK —— 通过 :class:`LlmClientLike` Protocol 注入；测试用 ``FakeLlm``。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol, runtime_checkable

from mate_kernel.agent.orchestrator import AgentRole
from mate_kernel.agent.prompts import SYSTEM_PROMPTS
from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.query.object_set import ObjectSet


# ─────────────────── LLM Client Protocol（M3+ LLM 注入点）───────────────────


@runtime_checkable
class LlmClientLike(Protocol):
    """thin LLM client contract —— production 接 LlmgwClient，测试接 FakeLlm。

    chat() 必须返回 LLM 的纯文本响应；本 Agent 负责 JSON 解析 + 验证。
    """

    async def chat(self, system: str, user: str, **kwargs: Any) -> str: ...


# ─────────────────── LLM dispatcher（提议走 tech-ont v2 端点）───────────────────


@runtime_checkable
class LlmDispatcher(Protocol):
    """Agent 调 ``chat`` 选好 action 后，往 tech-ont dispatch 的注入点。

    tech-ont / orchestrator 实现走 ``OntologyActionClient``；测试用
    ``InMemoryLlmDispatcher``。每个方法返回 ``proposal_id`` 或查询结果 dict。
    """

    async def list_object_types(self, tenant_id: str, **kwargs: Any) -> list[dict[str, Any]]: ...

    async def inspect_class(
        self, tenant_id: str, class_rid: str, **kwargs: Any,
    ) -> dict[str, Any]: ...

    async def search_objects(
        self,
        tenant_id: str,
        text: str,
        class_rid: str | None,
        top_k: int,
        **kwargs: Any,
    ) -> list[dict[str, Any]]: ...

    async def propose_object_type(
        self,
        tenant_id: str,
        type_def: dict[str, Any],
        impact_summary: str,
        **kwargs: Any,
    ) -> str:
        """返回 ``proposal_id``。"""

    async def propose_instance(
        self,
        tenant_id: str,
        class_rid: str,
        props: dict[str, Any],
        impact_summary: str,
        **kwargs: Any,
    ) -> str:
        """返回 ``proposal_id``。"""

    async def propose_merge(
        self,
        tenant_id: str,
        source_rid: str,
        target_rid: str,
        similarity: float,
        impact_summary: str,
        mapping: dict[str, str],
        **kwargs: Any,
    ) -> str:
        """返回 ``proposal_id``。"""


# ─────────────────── Schema 与 dispatch 结果 ───────────────────


ACTION_KINDS: tuple[str, ...] = (
    "list",
    "inspect",
    "propose_object_type",
    "propose_instance",
    "merge_suggestion",
    "search",
)


@dataclass(frozen=True, slots=True)
class LlmDispatchResult:
    """LLM-driven dispatch outcome —— 供 SuperAI/前端 trace & 渲染。"""

    action: str  # 解析出的 action_kind
    parameters: dict[str, Any]  # 解析出的 parameters
    reason: str  # LLM 给出的 reason（一句话）
    proposal_id: str | None = None  # propose_* 时返回
    raw_output: str = ""  # LLM 原始输出（debug / audit）
    error: str | None = None  # 解析失败 / 未知 action 时填
    candidates: list[dict[str, Any]] = field(default_factory=list)  # search 命中
    extra: dict[str, Any] = field(default_factory=dict)  # inspect / list 的快照


# ─────────────────── JSON action schema 提取（健壮 fallback）───────────────────


_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def _extract_first_json(text: str) -> dict[str, Any] | None:
    """从 LLM 输出里抓首个 JSON 对象。

    LLM 常在 JSON 外加 ``Here is your answer:`` 或者代码块包裹；
    本函数尽量宽容，失败返回 ``None`` 让上层 graceful fallback。
    """
    if not text:
        return None
    # 1) 整段就是 JSON
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except (json.JSONDecodeError, ValueError):
        pass
    # 2) Markdown 代码块
    m = _FENCE_RE.search(text)
    if m:
        body = m.group(1).strip()
        try:
            obj = json.loads(body)
            if isinstance(obj, dict):
                return obj
        except (json.JSONDecodeError, ValueError):
            pass
    # 3) 第一个 ``{ ... }`` 平衡提取（容忍前后自然语言）
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start >= 0:
                    candidate = text[start : i + 1]
                    try:
                        obj = json.loads(candidate)
                        if isinstance(obj, dict):
                            return obj
                    except (json.JSONDecodeError, ValueError):
                        start = -1
    return None


def _normalize_action(data: dict[str, Any]) -> tuple[str, dict[str, Any], str]:
    """验证 / 归一 JSON action：返回 ``(action, parameters, reason)``；无效则抛 ``ValueError``。"""
    raw_action = data.get("action")
    if not isinstance(raw_action, str):
        raise ValueError("missing 'action' field")
    action = raw_action.strip().lower()
    if action not in ACTION_KINDS:
        raise ValueError(f"unknown action_kind: {raw_action!r}")
    params = data.get("parameters")
    if params is None:
        params = {}
    if not isinstance(params, dict):
        raise ValueError("'parameters' must be an object")
    reason = data.get("reason") or ""
    if not isinstance(reason, str):
        reason = str(reason)
    return action, dict(params), reason


def _build_object_type_rid(tenant_id: str, slug: str, version: int = 1) -> str:
    slug = re.sub(r"[^a-z0-9_-]+", "-", slug.strip().lower()).strip("-") or "type"
    return f"ont.{tenant_id}.obj.{slug}.v{version}"


def _build_property_rid(tenant_id: str, ot_slug: str, prop_slug: str, version: int = 1) -> str:
    p = re.sub(r"[^a-z0-9_-]+", "-", prop_slug.strip().lower()).strip("-") or "field"
    return f"ont.{tenant_id}.prop.{ot_slug}-{p}.v{version}"


def _propose_object_type_payload(
    tenant_id: str, parameters: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    """把 LLM 给的 propose_object_type 参数归一成 ObjectTypeDTO 兼容 dict + impact 文本。"""
    slug = str(parameters.get("slug") or parameters.get("name") or "type")
    rid = _build_object_type_rid(tenant_id, slug)
    primary_key_prop = str(
        parameters.get("primary_key") or "id"
    ).strip() or "id"
    raw_props = parameters.get("properties") or []
    if not isinstance(raw_props, list):
        raise ValueError("'properties' must be a list")
    prop_dicts: list[dict[str, Any]] = []
    prop_seen: set[str] = set()
    for p in raw_props:
        if not isinstance(p, dict):
            continue
        name = str(p.get("name") or "").strip()
        if not name or name in prop_seen:
            continue
        prop_seen.add(name)
        type_id = str(p.get("type_id") or "string")
        if type_id not in {"string", "int", "float", "bool", "datetime", "json"}:
            type_id = "string"
        is_pk = bool(p.get("primary_key")) or name == primary_key_prop
        prop_dicts.append({
            "rid": _build_property_rid(tenant_id, slug, name),
            "type_id": type_id,
            "nullable": bool(p.get("nullable", not is_pk)),
            "primary_key": is_pk,
            "title": str(p.get("title") or name),
            "format": type_id,
        })
    if not any(p["primary_key"] for p in prop_dicts):
        prop_dicts.insert(0, {
            "rid": _build_property_rid(tenant_id, slug, primary_key_prop),
            "type_id": "string",
            "nullable": False,
            "primary_key": True,
            "title": primary_key_prop,
            "format": "string",
        })
    pk_rid = next(p["rid"] for p in prop_dicts if p["primary_key"])
    type_def: dict[str, Any] = {
        "rid": rid,
        "primary_key": [pk_rid],
        "properties": prop_dicts,
        "display_name": str(parameters.get("display_name") or parameters.get("name") or slug),
        "interfaces": list(parameters.get("interfaces") or []),
        "marking": [],
    }
    impact = (
        f"将创建 ObjectType {rid}，含 {len(prop_dicts)} 个属性，主键 {pk_rid}；"
        f"随后进 proposal 状态机（pending → 用户确认 → applied）。"
    )
    return type_def, impact


# ─────────────────── Rule-based 旧接口（保留 M2 兼容）───────────────────


@dataclass(frozen=True, slots=True)
class OntologyAgentRequest:
    """自然语言请求 → Ontology 员工。"""
    user_query: str  # "所有状态=open 的订单"
    context_rids: tuple[str, ...] = ()  # 已 resolve 的 rid 集合


@dataclass(frozen=True, slots=True)
class OntologyAgentResponse:
    proposed_object_set: ObjectSet | None
    explanation: str  # 自然语言解释
    confidence: float  # 0..1
    needs_clarification: bool
    suggestions: tuple[str, ...] = ()


@runtime_checkable
class OntologyQueryPlanner(Protocol):
    """把 user_query → ObjectSet。M2 简化版。"""

    def plan(self, query: str, default_class: ClassRef | None) -> ObjectSet: ...


class SimpleQueryPlanner:
    """基于正则的查询计划器 —— 把 `状态=open` 这类自然语言翻成 filter_expr。"""

    _PATTERN = re.compile(r"([\w一-鿿]+)\s*(==|!=|>=|<=|=|:|>|<)\s*['\"]?([\w一-鿿.\-]+)['\"]?")

    def plan(self, query: str, default_class: ClassRef | None) -> ObjectSet:
        # 提取所有 `字段 操作 值` 片段
        matches = self._PATTERN.findall(query)
        expr_parts: list[str] = []
        for field_name, op, value in matches:
            field_clean = field_name.strip()
            op_clean = op.strip()
            # 数值 / 字符串归一
            try:
                num = float(value)
                expr_parts.append(f"{field_clean} {op_clean} {num:g}")
            except ValueError:
                v = value.strip()
                if not op_clean:
                    op_clean = "=="
                expr_parts.append(f"{field_clean} {op_clean} '{v}'")
        filter_expr = " AND ".join(expr_parts)
        cls = default_class or ClassRef(rid="ont.acme.cls.order.v1")
        return ObjectSet(class_rid=cls, filter_expr=filter_expr)


class OntologyAgent:
    """Ontology 数字员工 = Planner + Manager + 解释生成。

    主入口：
    - ``handle(req, manager, default_class)``：M2 风格的 rule-based stub，
      仍然可用（向后兼容 + 离线 fallback）。
    - ``handle_message(message, context)``：M3+ 主路径，LLM 决策 + 提议 dispatch，
      所有 schema 变更走 proposal 状态机，不直接落库。
    """

    def __init__(
        self,
        planner: OntologyQueryPlanner | None = None,
        llm: LlmClientLike | None = None,
        dispatcher: LlmDispatcher | None = None,
        system_prompt: str | None = None,
    ) -> None:
        self.planner = planner or SimpleQueryPlanner()
        self._llm = llm  # None → handle_message 仍可被调用，但会返回 error
        self._dispatcher = dispatcher
        self._system_prompt_override = system_prompt

    # ───── rule-based legacy handle() ─────

    def handle(
        self,
        req: OntologyAgentRequest,
        manager: Manager,
        default_class: ClassRef | None = None,
    ) -> OntologyAgentResponse:
        # 1) 解析查询
        os_ = self.planner.plan(req.user_query, default_class)

        # 2) 解释
        explanation = self._explain(req.user_query, os_)

        # 3) 经理追踪
        manager.track(
            kind=__import__("mate_kernel.manager.protocol", fromlist=["ChangeKind"]).ChangeKind.SNAPSHOT_VERSION,
            target_rid=os_.class_rid.rid,
            payload={"query": req.user_query, "filter": os_.filter_expr},
        )

        # 4) 信心度：filter 为空 → 低；有命中 → 高
        confidence = 0.9 if os_.filter_expr else 0.3

        # 5) 建议
        suggestions: list[str] = []
        if not os_.filter_expr:
            suggestions.append("请提供更具体的过滤条件，例如：状态=open")
        if default_class is None:
            suggestions.append("未指定目标 ObjectType，已默认 order")

        return OntologyAgentResponse(
            proposed_object_set=os_,
            explanation=explanation,
            confidence=confidence,
            needs_clarification=not bool(os_.filter_expr),
            suggestions=tuple(suggestions),
        )

    @staticmethod
    def _explain(query: str, os_: ObjectSet) -> str:
        if not os_.filter_expr:
            return f"查询「{query}」未解析出过滤条件，需要补充字段约束。"
        return (
            f"查询「{query}」解析为：\n"
            f"- 目标类型：{os_.class_rid.rid}\n"
            f"- 过滤条件：{os_.filter_expr}"
        )

    # ───── LLM-backed handle_message() ─────

    async def handle_message(
        self,
        message: str,
        context: dict[str, Any] | None = None,
    ) -> LlmDispatchResult:
        """LLM 决策 + dispatcher 提议。

        ``context`` 可携带：
        - tenant_id（必填 —— action 内会显式用作 rid 命名空间 & dispatch 入参）
        - candidate_rid（可选 —— LLM 想 inspect / propose_instance 时可作 hint）
        - request_id / session_id（仅做 trace / 日志）
        - precheck_top_k（可选；search 类用，默认 5）
        """
        ctx = dict(context or {})
        tenant_id = str(ctx.get("tenant_id") or "default").strip() or "default"

        if self._llm is None:
            return LlmDispatchResult(
                action="error",
                parameters={},
                reason="",
                error="llm_not_configured",
            )
        if not message or not message.strip():
            return LlmDispatchResult(
                action="error",
                parameters={},
                reason="",
                error="empty_message",
            )

        system_prompt = (
            self._system_prompt_override
            or SYSTEM_PROMPTS.get(AgentRole.ONTOLOGY, "")
        )
        user_prompt = self._build_user_prompt(message, ctx, tenant_id)
        try:
            raw = await self._llm.chat(system_prompt, user_prompt)
        except Exception as e:  # LLM 通道本身挂掉 —— 也不抛
            return LlmDispatchResult(
                action="error",
                parameters={},
                reason="",
                raw_output=str(e),
                error=f"llm_chat_failed: {type(e).__name__}",
            )

        obj = _extract_first_json(raw)
        if obj is None:
            return LlmDispatchResult(
                action="error",
                parameters={},
                reason="",
                raw_output=raw,
                error="llm_output_not_json",
            )

        try:
            action, parameters, reason = _normalize_action(obj)
        except ValueError as e:
            return LlmDispatchResult(
                action="error",
                parameters={},
                reason="",
                raw_output=raw,
                error=f"invalid_action: {e}",
            )

        # 拒绝跨租户 rid / 兜底填充缺失字段
        try:
            action, parameters = self._sanitize_action(
                action, parameters, tenant_id,
            )
        except ValueError as e:
            return LlmDispatchResult(
                action=action,
                parameters=parameters,
                reason=reason,
                raw_output=raw,
                error=str(e),
            )

        # 无 dispatcher（kernel-only 单元测试场景）—— 只校验 + 返回解析结果
        if self._dispatcher is None:
            return LlmDispatchResult(
                action=action, parameters=parameters, reason=reason, raw_output=raw,
            )

        # Dispatch（只读 vs 提议类分两路；提议类必回 proposal_id）
        try:
            return await self._dispatch_action(action, parameters, reason, raw, tenant_id, ctx)
        except Exception as e:  # 真实调用任一段挂掉 —— graceful fallback
            return LlmDispatchResult(
                action=action, parameters=parameters, reason=reason, raw_output=raw,
                error=f"dispatch_failed: {type(e).__name__}: {e}",
            )

    @staticmethod
    def _build_user_prompt(message: str, ctx: dict[str, Any], tenant_id: str) -> str:
        bits = [message.strip()]
        if ctx.get("candidate_rid"):
            bits.append(f"[hint rid] {ctx['candidate_rid']}")
        if ctx.get("context_rids"):
            rids = [str(r) for r in ctx["context_rids"] if r]
            if rids:
                bits.append("[known rids] " + ", ".join(rids))
        bits.append(f"[tenant] {tenant_id}")
        bits.append(
            "请严格输出单个 JSON 对象，schema 见 system prompt。不要任何 "
            "额外文本、Markdown 代码块、自然语言段。"
        )
        return "\n".join(bits)

    @staticmethod
    def _sanitize_action(
        action: str, parameters: dict[str, Any], tenant_id: str,
    ) -> tuple[str, dict[str, Any]]:
        """拒绝跨租户 rid；为 propose_object_type 强制填充 rid；其它原样透传。"""
        if action in {"inspect", "propose_instance"}:
            rid_or_class = str(
                parameters.get("rid" if action == "inspect" else "class_rid") or ""
            ).strip()
            if not rid_or_class:
                raise ValueError(f"{action} 缺少 rid/class_rid 参数")
            prefix = f"ont.{tenant_id}."
            if not rid_or_class.startswith(prefix):
                raise ValueError(
                    f"cross-tenant rid denied: {rid_or_class} (need {prefix}*)"
                )
        elif action == "merge_suggestion":
            src = str(parameters.get("source_rid") or "").strip()
            tgt = str(parameters.get("target_rid") or "").strip()
            if not src or not tgt:
                raise ValueError("merge_suggestion 需要 source_rid 与 target_rid")
            prefix = f"ont.{tenant_id}."
            if not src.startswith(prefix) or not tgt.startswith(prefix):
                raise ValueError(
                    f"cross-tenant merge denied: {src} → {tgt}"
                )
        elif action == "propose_object_type":
            params = dict(parameters)
            slug = str(params.get("slug") or params.get("name") or "").strip()
            if not slug:
                raise ValueError("propose_object_type 需要 slug 或 name")
        return action, parameters

    async def _dispatch_action(
        self,
        action: str,
        parameters: dict[str, Any],
        reason: str,
        raw: str,
        tenant_id: str,
        ctx: dict[str, Any],
    ) -> LlmDispatchResult:
        assert self._dispatcher is not None
        if action == "list":
            items = await self._dispatcher.list_object_types(tenant_id)
            return LlmDispatchResult(
                action=action, parameters=parameters, reason=reason, raw_output=raw,
                extra={"items": items},
            )
        if action == "inspect":
            data = await self._dispatcher.inspect_class(
                tenant_id, str(parameters["rid"]),
            )
            return LlmDispatchResult(
                action=action, parameters=parameters, reason=reason, raw_output=raw,
                extra=data,
            )
        if action == "search":
            top_k = int(parameters.get("top_k") or ctx.get("precheck_top_k") or 5)
            class_rid = parameters.get("class_rid")
            cards = await self._dispatcher.search_objects(
                tenant_id, str(parameters.get("text") or ""),
                class_rid, top_k,
            )
            return LlmDispatchResult(
                action=action, parameters=parameters, reason=reason, raw_output=raw,
                candidates=cards,
            )
        if action == "propose_object_type":
            type_def, impact = _propose_object_type_payload(tenant_id, parameters)
            proposal_id = await self._dispatcher.propose_object_type(
                tenant_id, type_def, impact,
            )
            return LlmDispatchResult(
                action=action, parameters=parameters, reason=reason, raw_output=raw,
                proposal_id=proposal_id,
                extra={"type_def": type_def, "impact_summary": impact},
            )
        if action == "propose_instance":
            props = parameters.get("props") or {}
            if not isinstance(props, dict):
                raise ValueError("propose_instance 的 props 必须是对象")
            class_rid = str(parameters["class_rid"])
            impact = (
                f"将在 {class_rid} 下新建实例，含 {len(props)} 个属性；"
                "随后进 proposal 状态机，待用户确认。"
            )
            proposal_id = await self._dispatcher.propose_instance(
                tenant_id, class_rid, props, impact,
            )
            return LlmDispatchResult(
                action=action, parameters=parameters, reason=reason, raw_output=raw,
                proposal_id=proposal_id,
                extra={"impact_summary": impact},
            )
        if action == "merge_suggestion":
            try:
                sim = float(parameters.get("similarity") or 0.0)
            except (TypeError, ValueError):
                sim = 0.0
            mapping = parameters.get("mapping") or {}
            if not isinstance(mapping, dict):
                mapping = {}
            mapping = {str(k): str(v) for k, v in mapping.items()}
            impact = (
                f"提议合并 {parameters['source_rid']} → {parameters['target_rid']}"
                f"（similarity={sim:.2f}, 字段映射 {len(mapping)} 条）"
            )
            proposal_id = await self._dispatcher.propose_merge(
                tenant_id,
                str(parameters["source_rid"]),
                str(parameters["target_rid"]),
                sim, impact, mapping,
            )
            return LlmDispatchResult(
                action=action, parameters=parameters, reason=reason, raw_output=raw,
                proposal_id=proposal_id,
                extra={"impact_summary": impact},
            )
        # 理论上 ``_normalize_action`` 已经过滤；这里兜底
        return LlmDispatchResult(
            action=action, parameters=parameters, reason=reason, raw_output=raw,
            error="unknown_action_kind",
        )


__all__ = [
    "OntologyAgent",
    "OntologyAgentRequest",
    "OntologyAgentResponse",
    "OntologyQueryPlanner",
    "SimpleQueryPlanner",
    "LlmClientLike",
    "LlmDispatcher",
    "LlmDispatchResult",
    "ACTION_KINDS",
    "_extract_first_json",
    "_normalize_action",
    "_propose_object_type_payload",
]
