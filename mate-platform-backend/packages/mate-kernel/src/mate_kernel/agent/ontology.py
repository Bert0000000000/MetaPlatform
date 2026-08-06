"""AGENT-ONT-01: Ontology 数字员工。

7+1 数字员工中的「Ontology 员工」—— 由 SuperAIOrchestrator 在选择 AgentRole.ONTOLOGY 时路由。
职责：
- 解释 ClassRef / ObjectType / LinkType / ActionType 含义（自然语言 → 结构化 / 反向）
- 生成 ObjectSet 查询计划（基于自然语言需求）
- 校验 ActionType.apply 提交的 submission_criteria / side_effects 完整性
- 在 Manager 上下文中追踪所有变更

不依赖 LLM —— 用 rule-based stub。M3 接 AIP-GATEWAY-01 后可由 LLM 替换。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol, runtime_checkable

from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.query.object_set import ObjectSet


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
    """Ontology 数字员工 = Planner + Manager + 解释生成。"""

    def __init__(
        self,
        planner: OntologyQueryPlanner | None = None,
    ) -> None:
        self.planner = planner or SimpleQueryPlanner()

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


__all__ = [
    "OntologyAgent",
    "OntologyAgentRequest",
    "OntologyAgentResponse",
    "OntologyQueryPlanner",
    "SimpleQueryPlanner",
]
