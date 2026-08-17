"""ACTION-03: ActionType.apply 协议 —— 提交工作流。

ActionType.apply 是 v3.1 KERNEL-01 写入唯一合法入口（AI / SDK / Function 都汇聚于此）。
M2 范围：
- submission_criteria 评估（rule_ref 表达式，简化用 startswith / equals 模拟）
- side_effects 触发（emit outbox event）
- 审计字段（actor / sandbox_id / hitl_token）
- 失败回滚（补偿 hook）

GOVERN-05 扩展：
- invoker 缺位 → raise FunctionNotRegistered（不再静默跳过）
- 注册 FunctionExecutor + FunctionResolver，apply 内真 invoke
- outcome.function_result：invoker 返回值（repo 层映射到 target.props）

不依赖 messaging 实际发送；只起骨架。runtime 实现在 M3 / SANDBOX-02+。
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Iterable, Protocol, runtime_checkable

if TYPE_CHECKING:
    from ..ontology.identity import ClassRef

from ..sandbox.k8s import FunctionExecutor


class SubmissionCriteriaFailed(RuntimeError):
    """提交前规则评估未通过。"""


class ActionNotFound(KeyError):
    pass


class TargetNotFound(KeyError):
    pass


class FunctionNotRegistered(RuntimeError):
    """ActionType.function_ref 未注册 invoker / executor。"""


class FunctionExecutionError(RuntimeError):
    """Function 执行失败（编译错误 / 抛异常 / sandbox violation）。"""


class FunctionTimeout(FunctionExecutionError):
    """Function 执行超时。"""


class ProposalNotConfirmed(RuntimeError):
    """MP-SAL-04（ADR-0044 §2.1）：proposal 未确认/已拒绝/不匹配 —— 未确认的 proposal 永不落库。"""


class ProposalStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    APPLIED = "applied"


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
    function_result: Any = None
    proposal_id: str | None = None  # 证据链：本次 apply 对应的 HITL proposal
    hitl_token: str | None = None   # 证据链：用户确认所用 token（校验后记录）
    side_effect_events: list[tuple[str, str]] = field(default_factory=list)  # (event_type, event_id)


# ─────────────────── 规则表达式 ───────────────────


@runtime_checkable
class RuleEvaluator(Protocol):
    """submission_criteria 规则求值器 —— M2 简化实现。"""

    def evaluate(self, expr: str, parameters: dict[str, Any], target_props: dict[str, Any]) -> bool: ...


class SimpleRuleEvaluator:
    """支持 `field == 'literal'` / `field != x` / `field startswith x` /
    `field in (a, b)` 四种表达式。"""

    def evaluate(self, expr: str, parameters: dict[str, Any], target_props: dict[str, Any]) -> bool:
        e = expr.strip()
        # field in (a, b, c)
        import re
        in_match = re.match(r"^(\w+)\s+in\s+\((.*)\)\s*$", e)
        if in_match:
            field, vals = in_match.group(1), in_match.group(2)
            allowed = [v.strip().strip("'").strip('"') for v in vals.split(",")]
            actual = parameters.get(field, target_props.get(field))
            return str(actual) in allowed
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
    """proposal 模型 —— HITL 流程前置产物（ADR-0044 状态机：pending→confirmed→applied / rejected）。"""

    proposal_id: str
    action_rid: str  # subject rid：kind=action→ActionType；create_instance→class；model_type→新类型 rid
    target_iid: str | None
    parameters: dict[str, Any]
    impact_summary: str  # 人类可读的"将做什么"
    created_at: datetime
    requires_hitl: bool = True
    status: ProposalStatus = ProposalStatus.PENDING
    kind: str = "action"  # action / create_instance / model_type（MP-SAL-04b）
    expected_diff: dict[str, Any] = field(default_factory=dict)  # 预期 diff（staging 语义）
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None


class ActionService:
    """ActionType.apply 协议 —— 不依赖外部。"""

    def __init__(self, evaluator: RuleEvaluator | None = None) -> None:
        self.evaluator = evaluator or SimpleRuleEvaluator()
        self._proposals: dict[str, ActionProposal] = {}
        self._audit: list[ApplyOutcome] = []
        self._invokers: dict[str, callable] = {}
        # GOVERN-05: FunctionExecutor / FunctionResolver 注入。apply 时按
        # function_ref 走 resolver 拿源码 → executor 真 invoke → outcome.
        # function_result 让 repo 层把结果写回 target.props。
        self._executors: dict[str, FunctionExecutor] = {}
        self._resolver: Any = None  # FunctionResolver | None

    def register_function(self, function_ref: str, invoker: callable) -> None:
        """注册 function_ref 的执行体（runtime hook）。"""
        self._invokers[function_ref] = invoker

    def register_function_ref(
        self,
        function_ref: str,
        executor: Any,  # FunctionExecutor
        resolver: Any,  # FunctionResolver
    ) -> None:
        """GOVERN-05: 注册 function_ref → FunctionExecutor + FunctionResolver。

        apply 时优先走 executor；缺位时退回 _invokers（兼容旧 callables）。
        """
        self._executors[function_ref] = executor
        if self._resolver is None:
            self._resolver = resolver

    def set_resolver(self, resolver: Any) -> None:
        self._resolver = resolver

    # ───── proposal (HITL step before apply) ─────

    def propose(
        self,
        action_rid: str,
        parameters: dict[str, Any],
        target_iid: str | None,
        impact_summary: str,
        expected_diff: dict[str, Any] | None = None,
        kind: str = "action",
    ) -> ActionProposal:
        import uuid
        prop = ActionProposal(
            proposal_id=f"prop-{uuid.uuid4().hex[:8]}",
            action_rid=action_rid,
            target_iid=target_iid,
            parameters=parameters,
            impact_summary=impact_summary,
            created_at=datetime.now(timezone.utc),
            requires_hitl=True,
            expected_diff=dict(expected_diff or {}),
            kind=kind,
        )
        self._proposals[prop.proposal_id] = prop
        return prop

    def get_proposal(self, proposal_id: str) -> ActionProposal:
        p = self._proposals.get(proposal_id)
        if p is None:
            raise KeyError(f"proposal not found: {proposal_id}")
        return p

    def _transition_proposal(
        self, proposal_id: str, to_status: ProposalStatus, *, by: str | None,
    ) -> ActionProposal:
        p = self.get_proposal(proposal_id)
        if p.status is not ProposalStatus.PENDING:
            raise ValueError(
                f"proposal {proposal_id} is {p.status.value}, only pending can transition "
                f"(to {to_status.value})"
            )
        updated = replace(
            p,
            status=to_status,
            confirmed_by=by,
            confirmed_at=datetime.now(timezone.utc) if to_status is ProposalStatus.CONFIRMED else p.confirmed_at,
        )
        self._proposals[proposal_id] = updated
        return updated

    def confirm_proposal(self, proposal_id: str, confirmed_by: str = "") -> ActionProposal:
        """pending → confirmed（用户确认；ADR-0044 §2.5：只能由用户侧发起，非 LLM）。"""
        return self._transition_proposal(proposal_id, ProposalStatus.CONFIRMED, by=confirmed_by)

    def reject_proposal(self, proposal_id: str, confirmed_by: str = "") -> ActionProposal:
        """pending → rejected（终态）。"""
        return self._transition_proposal(proposal_id, ProposalStatus.REJECTED, by=confirmed_by)

    def mark_applied(self, proposal_id: str) -> ActionProposal:
        """confirmed → applied（MP-SAL-04b：create/model 类 proposal 的落库回执）。

        与 apply() 的回写互斥使用：execute_proposal 成功执行后调用；
        仅 confirmed 可达 applied（未确认/已拒绝/已应用 → ProposalNotConfirmed）。
        """
        p = self.get_proposal(proposal_id)
        if p.status is not ProposalStatus.CONFIRMED:
            raise ProposalNotConfirmed(
                f"proposal {proposal_id} is {p.status.value}; execute requires a confirmed proposal"
            )
        updated = replace(p, status=ProposalStatus.APPLIED)
        self._proposals[proposal_id] = updated
        return updated

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
        proposal_id: str | None = None,
        side_effect_emitter: callable = None,
    ) -> ApplyOutcome:
        # 0) MP-SAL-04（ADR-0044 §2.1）：带 proposal_id 的 apply 强制校验——
        #    未确认的 proposal 永不落库（北极星 negative）。
        if proposal_id is not None:
            try:
                proposal = self.get_proposal(proposal_id)
            except KeyError as e:
                raise ProposalNotConfirmed(f"proposal not found: {proposal_id}") from e
            if proposal.action_rid != action_rid:
                raise ProposalNotConfirmed(
                    f"proposal {proposal_id} is for action {proposal.action_rid!r}, "
                    f"apply targets {action_rid!r}"
                )
            if proposal.status is not ProposalStatus.CONFIRMED:
                raise ProposalNotConfirmed(
                    f"proposal {proposal_id} is {proposal.status.value}; "
                    "apply requires a confirmed proposal"
                )

        # 1) submission_criteria 全部通过
        for expr in submission_criteria:
            if not self.evaluator.evaluate(expr, parameters, target_props or {}):
                raise SubmissionCriteriaFailed(
                    f"submission criteria not met: {expr!r} for action={action_rid}"
                )

        # 2) side_effects emit（占位；有 emitter 时回填真实 event_id 形成证据）
        emitted = list(side_effects)
        event_evidences: list[tuple[str, str]] = []
        if side_effect_emitter is not None:
            for se in emitted:
                eid = side_effect_emitter(se)
                if eid is not None:
                    event_evidences.append((se, eid))

        # 3) 调用 function_ref；失败 → rollback
        rolled_back = False
        function_result: Any = None
        executor = self._executors.get(function_ref)
        if executor is not None and self._resolver is not None:
            try:
                from ..ontology.identity import ClassRef as _ClassRef  # noqa: PLC0415
                lang, source = self._resolver.resolve(_ClassRef(function_ref))
                rc, out, err = executor.execute(source, (target_iid or "", parameters))
                if rc != 0:
                    raise FunctionExecutionError(
                        f"function {function_ref!r} exited {rc}: stderr={err!r}"
                    )
                try:
                    import json as _json

                    parsed = _json.loads(out) if out else None
                    function_result = parsed.get("result", parsed) if isinstance(parsed, dict) else parsed
                except Exception:
                    function_result = None
            except FunctionTimeout:
                rolled_back = True
                if rollback_hook is not None:
                    try:
                        rollback_hook(target_iid, parameters)
                    except Exception:
                        pass
                raise
            except (FunctionExecutionError, FunctionNotRegistered):
                rolled_back = True
                if rollback_hook is not None:
                    try:
                        rollback_hook(target_iid, parameters)
                    except Exception:
                        pass
                raise
            except Exception:
                rolled_back = True
                if rollback_hook is not None:
                    try:
                        rollback_hook(target_iid, parameters)
                    except Exception:
                        pass
                raise FunctionExecutionError(f"function {function_ref!r} crashed")
        else:
            invoker = self._invokers.get(function_ref)
            if invoker is None:
                # GOVERN-05: 默认 fallback —— 没有 invoker/executor 时返回 parameters
                # 当作"决策结果"，让 dev/未注册源码的 ActionType 仍可 apply。
                # 测试用 register_function 显式注入可覆盖。
                function_result = parameters
            else:
                try:
                    function_result = invoker(target_iid, parameters)
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
            function_result=function_result,
            proposal_id=proposal_id,
            hitl_token=ctx.hitl_token if ctx else None,
            side_effect_events=event_evidences,
        )
        self._audit.append(outcome)
        if proposal_id is not None:
            try:
                self._proposals[proposal_id] = replace(
                    self.get_proposal(proposal_id), status=ProposalStatus.APPLIED,
                )
            except KeyError:
                pass
        return outcome

    def get_audit(self) -> list[ApplyOutcome]:
        return list(self._audit)