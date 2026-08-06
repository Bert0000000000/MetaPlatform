"""ACTION-03: ActionType.apply 协议 —— 提交工作流。

ActionType.apply 是 v3.1 KERNEL-01 写入唯一合法入口（AI / SDK / Function 都汇聚于此）。
M2 范围：
- submission_criteria 评估（rule_ref 表达式，简化用 startswith / equals 模拟）
- side_effects 触发（emit outbox event）
- 审计字段（actor / sandbox_id / hitl_token）
- 失败回滚（补偿 hook）

不依赖 messaging 实际发送；只起骨架。runtime 实现在 M3 / SANDBOX-02+。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Protocol, runtime_checkable


class SubmissionCriteriaFailed(RuntimeError):
    """提交前规则评估未通过。"""


class ActionNotFound(KeyError):
    pass


class TargetNotFound(KeyError):
    pass


@dataclass(frozen=True, slots=True)
class SubmissionContext:
    """apply 时的来源信息（13 硬规则 #9 审计）。"""
    actor: str  # user_id 或 service-account
    sandbox_id: str | None = None
    hitl_token: str | None = None
    tenant_id: str | None = None
    correlation_id: str | None = None


@dataclass(frozen=True, slots=True)
class ApplyOutcome:
    action_rid: str
    target_iid: str | None
    applied_at: datetime
    side_effects_emitted: list[str]
    audit_id: str
    rolled_back: bool = False


# ─────────────────── 规则表达式 ───────────────────


@runtime_checkable
class RuleEvaluator(Protocol):
    """submission_criteria 规则求值器 —— M2 简化实现。"""

    def evaluate(self, expr: str, parameters: dict[str, Any], target_props: dict[str, Any]) -> bool: ...


class SimpleRuleEvaluator:
    """支持 `field == 'literal'` / `field != x` / `field startswith x` 三种表达式。"""

    def evaluate(self, expr: str, parameters: dict[str, Any], target_props: dict[str, Any]) -> bool:
        e = expr.strip()
        # == 'literal'
        if "==" in e:
            field, val = e.split("==", 1)
            field = field.strip()
            val = val.strip().strip("'").strip('"')
            actual = parameters.get(field, target_props.get(field))
            return str(actual) == val
        # != value
        if "!=" in e:
            field, val = e.split("!=", 1)
            field = field.strip()
            val = val.strip().strip("'").strip('"')
            actual = parameters.get(field, target_props.get(field))
            return str(actual) != val
        # startswith value
        if "startswith" in e:
            field, val = e.split("startswith", 1)
            field = field.strip()
            val = val.strip().strip("'").strip('"')
            actual = str(parameters.get(field, target_props.get(field, "")))
            return actual.startswith(val)
        # 默认：truthy
        return bool(parameters.get(e.strip(), target_props.get(e.strip())))


# ─────────────────── Action Apply 引擎 ───────────────────


@dataclass(frozen=True, slots=True)
class ActionProposal:
    """proposal 模型 —— HITL 流程前置产物。"""

    action_rid: str
    target_iid: str | None
    parameters: dict[str, Any]
    impact_summary: str  # 人类可读的"将做什么"
    created_at: datetime
    requires_hitl: bool = True


class ActionService:
    """ActionType.apply 协议 —— 不依赖外部。"""

    def __init__(self, evaluator: RuleEvaluator | None = None) -> None:
        self.evaluator = evaluator or SimpleRuleEvaluator()
        self._proposals: dict[str, ActionProposal] = {}
        self._audit: list[ApplyOutcome] = []
        self._invokers: dict[str, callable] = {}

    def register_function(self, function_ref: str, invoker: callable) -> None:
        """注册 function_ref 的执行体（runtime hook）。"""
        self._invokers[function_ref] = invoker

    # ───── proposal (HITL step before apply) ─────

    def propose(
        self,
        action_rid: str,
        parameters: dict[str, Any],
        target_iid: str | None,
        impact_summary: str,
    ) -> ActionProposal:
        prop = ActionProposal(
            action_rid=action_rid,
            target_iid=target_iid,
            parameters=parameters,
            impact_summary=impact_summary,
            created_at=datetime.now(timezone.utc),
            requires_hitl=True,
        )
        self._proposals[prop.created_at.isoformat()] = prop
        return prop

    # ───── apply (post-HITL confirmation) ─────

    def apply(
        self,
        action_rid: str,
        submission_criteria: Iterable[str],
        function_ref: str,
        on_rid: str,
        target_iid: str | None,
        parameters: dict[str, Any],
        side_effects: Iterable[str],
        ctx: SubmissionContext,
        target_props: dict[str, Any] | None = None,
        rollback_hook: callable = None,
    ) -> ApplyOutcome:
        # 1) submission_criteria 全部通过
        for expr in submission_criteria:
            if not self.evaluator.evaluate(expr, parameters, target_props or {}):
                raise SubmissionCriteriaFailed(
                    f"submission criteria not met: {expr!r} for action={action_rid}"
                )

        # 2) side_effects emit（占位）
        emitted = list(side_effects)

        # 3) 调用 function_ref；失败 → rollback
        rolled_back = False
        invoker = self._invokers.get(function_ref)
        if invoker is not None:
            try:
                invoker(target_iid, parameters)
            except Exception:
                rolled_back = True
                if rollback_hook is not None:
                    try:
                        rollback_hook(target_iid, parameters)
                    except Exception:
                        pass
                raise

        outcome = ApplyOutcome(
            action_rid=action_rid,
            target_iid=target_iid,
            applied_at=datetime.now(timezone.utc),
            side_effects_emitted=emitted,
            audit_id=f"audit-{len(self._audit) + 1}",
            rolled_back=rolled_back,
        )
        self._audit.append(outcome)
        return outcome

    def get_audit(self) -> list[ApplyOutcome]:
        return list(self._audit)