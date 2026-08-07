"""SUPER-COPILOT-01: SuperAI 编排平面 runtime。

SuperAI = COPILOT 角色 —— 把用户的"自然语言意图"解析为 PlanSpec，
按 PlanStep 选择对应数字员工执行，HITL token 校验，OPT-IN 7d 审计持久化（C3）。

新增（vs M1 AGENT-ORCH-01）：
- IntentRouter：自然语言 → PlanSpec（heuristic + capability 匹配）
- MultiAgentRunner：PlanStep → 选 AgentRole → 调对应员工 → StepResult
- HitlTokenStore：会话级短期 token（B2 决策）+ 校验
- AuditRetention：C3 决策 —— 默认 discard，opt-in 7d 持久化

M3 范围：内存版；持久化在 v4 路线（runtime / PG）。
"""

from __future__ import annotations

import re
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Protocol, runtime_checkable

from mate_kernel.agent.orchestrator import (
    AgentRole,
    AgentSelector,
    PlanSpec,
    PlanState,
    PlanStep,
    StepKind,
    StepResult,
    StepStatus,
    SuperAIOrchestrator,
)
from mate_kernel.agent.prompts import SYSTEM_PROMPTS
from mate_kernel.manager.protocol import Manager, ManagerContext


class RetentionPolicy(str, Enum):
    DISCARD = "discard"           # C3 默认：不持久化
    PERSIST_7D = "persist_7d"     # C3 opt-in：保留 7 天


@dataclass(frozen=True, slots=True)
class HitlToken:
    token: str
    session_id: str
    user_id: str
    tenant_id: str
    plan_id: str
    step_id: str
    expires_at: datetime
    used: bool = False

    def is_valid(self, now: datetime | None = None) -> bool:
        now = now or datetime.now(timezone.utc)
        return not self.used and now < self.expires_at


class HitlTokenStore:
    """会话级短期 token（B2）。"""

    def __init__(self, ttl_seconds: int = 30 * 60) -> None:
        self.ttl = ttl_seconds
        self._tokens: dict[str, HitlToken] = {}

    def issue(self, ctx: ManagerContext, plan_id: str, step_id: str) -> HitlToken:
        t = HitlToken(
            token=secrets.token_urlsafe(16),
            session_id=ctx.session_id,
            user_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            plan_id=plan_id,
            step_id=step_id,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=self.ttl),
        )
        self._tokens[t.token] = t
        return t

    def validate(self, token: str, plan_id: str, step_id: str) -> HitlToken:
        t = self._tokens.get(token)
        if t is None:
            raise PermissionError("unknown token")
        if not t.is_valid():
            raise PermissionError("token expired")
        if t.plan_id != plan_id or t.step_id != step_id:
            raise PermissionError("token/plan/step mismatch")
        return t

    def consume(self, token: str) -> HitlToken:
        # 仅校验有效期（不校验 plan/step —— consume 本身只关心 expired/used）
        t = self._tokens.get(token)
        if t is None:
            raise PermissionError("unknown token")
        if not t.is_valid():
            raise PermissionError("token expired")
        object.__setattr__(t, "used", True)
        self._tokens[token] = t
        return t


# ─────────────────── 意图路由 ───────────────────

_INTENT_KEYWORDS: dict[AgentRole, tuple[str, ...]] = {
    AgentRole.ONTOLOGY: ("数据", "对象", "类型", "本体", "ontology", "object", "type"),
    AgentRole.WORKFLOW: ("流程", "审批", "BPMN", "workflow", "approve"),
    AgentRole.APP: ("页面", "应用", "表单", "列表", "page", "app", "form", "list"),
    AgentRole.DATA_PRODUCT: ("数据产品", "血缘", "质量", "data product", "lineage", "quality"),
    AgentRole.OBS: ("告警", "指标", "监控", "alert", "metric", "monitor", "dashboard"),
    AgentRole.SECURITY: ("权限", "安全", "合规", "permission", "security", "compliance", "marking"),
    AgentRole.KNOWLEDGE: ("文档", "知识", "wiki", "doc", "kb", "knowledge", "faq"),
}


class IntentRouter:
    """自然语言 → AgentRole（heuristic）。"""

    def __init__(self, selector: AgentSelector | None = None) -> None:
        self.selector = selector or AgentSelector()

    def route(self, query: str) -> AgentRole:
        q = query.lower()
        scores: dict[AgentRole, int] = {role: 0 for role in AgentRole}
        for role, keywords in _INTENT_KEYWORDS.items():
            for kw in keywords:
                if kw.lower() in q:
                    scores[role] += 1
        # 选最高分；并列时选 SUPERAI（fallback）
        best_role = max(scores, key=lambda r: scores[r])
        if scores[best_role] == 0:
            return AgentRole.SUPERAI
        return best_role

    def prompt(self, role: AgentRole) -> str:
        """数字员工 system prompt：M3 接 AIP-GATEWAY-01 后由员工 LLM 包装器取用。"""
        return SYSTEM_PROMPTS[role]

    def plan(self, query: str, author_user_id: str, plan_id: str) -> PlanSpec:
        """自然语言 → PlanSpec（每个 query 一个 PROPOSE 步骤 + 一个 APPLY_ACTION 占位）。"""
        role = self.route(query)
        return PlanSpec(
            plan_id=plan_id,
            author_user_id=author_user_id,
            steps=(
                PlanStep(
                    step_id="1",
                    kind=StepKind.PROPOSE,
                    target=f"intent.{role.value}",
                    payload=(("query", query),),
                    requires_hitl=True,
                ),
                PlanStep(
                    step_id="2",
                    kind=StepKind.APPLY_ACTION,
                    target=f"ont.acme.act.execute_{role.value}",
                    requires_hitl=False,
                ),
            ),
        )


# ─────────────────── Audit Retention ───────────────────


@dataclass(frozen=True, slots=True)
class AuditRecord:
    plan_id: str
    user_id: str
    tenant_id: str
    recorded_at: datetime
    final_state: str  # "completed" / "aborted" / "failed"
    steps: tuple[StepResult, ...]
    expires_at: datetime | None  # None = 永久 / 不适用


class AuditRetention:
    """C3 决策：默认 discard；opt-in 7d。"""

    def __init__(self, policy: RetentionPolicy = RetentionPolicy.DISCARD) -> None:
        self.policy = policy
        self._records: list[AuditRecord] = []

    def record(self, plan: PlanState, ctx: ManagerContext) -> AuditRecord | None:
        if self.policy == RetentionPolicy.DISCARD:
            return None
        now = datetime.now(timezone.utc)
        rec = AuditRecord(
            plan_id=plan.plan.plan_id,
            user_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            recorded_at=now,
            final_state="aborted" if plan.aborted else "completed",
            steps=tuple(plan.history),
            expires_at=now + timedelta(days=7),
        )
        self._records.append(rec)
        return rec

    def evict_expired(self, now: datetime | None = None) -> int:
        now = now or datetime.now(timezone.utc)
        before = len(self._records)
        self._records = [r for r in self._records if r.expires_at is None or r.expires_at > now]
        return before - len(self._records)

    def all_records(self) -> tuple[AuditRecord, ...]:
        return tuple(self._records)


# ─────────────────── SuperAI Copilot ───────────────────


@runtime_checkable
class AgentInvoker(Protocol):
    """把 step → StepResult。runtime 在 platform 层实现具体员工调度。"""

    def invoke(self, step: PlanStep, ctx: ManagerContext) -> StepResult: ...


class NullAgentInvoker:
    """空实现 —— 只把 PROPOSE/APPLY 步骤转成 StepResult 不实际执行。"""

    def invoke(self, step: PlanStep, ctx: ManagerContext) -> StepResult:
        if step.kind == StepKind.PROPOSE:
            return StepResult(step_id=step.step_id, status=StepStatus.HITL_WAITING)
        return StepResult(step_id=step.step_id, status=StepStatus.COMPLETED)


@dataclass(frozen=True, slots=True)
class SuperAICopilotConfig:
    retention: RetentionPolicy = RetentionPolicy.DISCARD
    hitl_ttl_seconds: int = 30 * 60


class SuperAICopilot:
    """SuperAI 编排平面 —— PlanSpec + 多 Agent + HITL + 审计。"""

    def __init__(
        self,
        config: SuperAICopilotConfig | None = None,
        router: IntentRouter | None = None,
        invoker: AgentInvoker | None = None,
    ) -> None:
        self.config = config or SuperAICopilotConfig()
        self.router = router or IntentRouter()
        self.invoker = invoker or NullAgentInvoker()
        self.orchestrator = SuperAIOrchestrator()
        self.token_store = HitlTokenStore(ttl_seconds=self.config.hitl_ttl_seconds)
        self.audit = AuditRetention(policy=self.config.retention)

    def submit_query(
        self, query: str, ctx: ManagerContext, manager: Manager,
    ) -> tuple[PlanState, HitlToken]:
        plan_id = SuperAIOrchestrator.new_plan_id()
        spec = self.router.plan(query, author_user_id=ctx.user_id, plan_id=plan_id)
        manager.track(
            kind=__import__("mate_kernel.manager.protocol", fromlist=["ChangeKind"]).ChangeKind.APPLY_ACTION,
            target_rid=f"superai.plan.{plan_id}",
            payload={"query": query, "role": self.router.route(query).value},
        )
        state = self.orchestrator.submit(spec)
        # 立即触发 step 1 (PROPOSE) → HITL
        result = self.invoker.invoke(spec.steps[0], ctx)
        self.orchestrator.record(plan_id, result)
        token = self.token_store.issue(ctx, plan_id, spec.steps[0].step_id)
        return state, token

    def confirm_step(
        self,
        plan_id: str,
        step_id: str,
        token: str,
        ctx: ManagerContext,
        manager: Manager,
    ) -> PlanState:
        # 1) 校验 token
        self.token_store.validate(token, plan_id=plan_id, step_id=step_id)
        self.token_store.consume(token)
        # 2) 当前 step 标 COMPLETED，推进
        self.orchestrator.record(plan_id, StepResult(step_id=step_id, status=StepStatus.COMPLETED))
        # 3) 下一 step（如有）执行
        s = self.orchestrator.get(plan_id)
        while not s.aborted and s.current_step is not None:
            step = s.current_step
            if step.requires_hitl:
                # 下一个 HITL → 停
                self.orchestrator.record(plan_id, self.invoker.invoke(step, ctx))
                token = self.token_store.issue(ctx, plan_id, step.step_id)
                manager.track(
                    kind=__import__("mate_kernel.manager.protocol", fromlist=["ChangeKind"]).ChangeKind.APPLY_ACTION,
                    target_rid=f"superai.plan.{plan_id}.step.{step.step_id}",
                    payload={"phase": "awaiting_hitl"},
                )
                return s
            result = self.invoker.invoke(step, ctx)
            self.orchestrator.record(plan_id, result)
            if result.status == StepStatus.FAILED:
                s = self.orchestrator.get(plan_id)
                break
            s = self.orchestrator.get(plan_id)
        # 4) 完结 → 审计
        self.audit.record(s, ctx)
        return self.orchestrator.get(plan_id)

    def abort(
        self,
        plan_id: str,
        reason: str,
        ctx: ManagerContext,
    ) -> PlanState:
        s = self.orchestrator.abort(plan_id, reason)
        self.audit.record(s, ctx)
        return s


__all__ = [
    "AgentInvoker",
    "AuditRecord",
    "AuditRetention",
    "HitlToken",
    "HitlTokenStore",
    "IntentRouter",
    "NullAgentInvoker",
    "RetentionPolicy",
    "SuperAICopilot",
    "SuperAICopilotConfig",
]
