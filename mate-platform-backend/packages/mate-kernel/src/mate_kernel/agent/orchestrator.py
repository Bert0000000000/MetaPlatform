"""SuperAI Orchestrator —— AGENT-ORCH-01 Batch。

SuperAI（COPILOT 角色）作为 7+1 数字员工的编排平面：
- 接收用户/SDK 输入 → 解析为 Plan（PlanSpec）
- 选择数字员工（按 ontology 与 capability 路由）
- 调度 ActionType.apply（KERNEL-01 入口）
- 状态机 + HITL 守门（与 SESSION-01 配合）
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
import uuid


class AgentRole(str, Enum):
    ONTOLOGY = "ontology"
    WORKFLOW = "workflow"
    APP = "app"
    DATA_PRODUCT = "data_product"
    OBS = "obs"
    SECURITY = "security"
    KNOWLEDGE = "knowledge"
    SUPERAI = "superai"  # COPILOT


class StepKind(str, Enum):
    CALL_AGENT = "call_agent"
    APPLY_ACTION = "apply_action"
    PROPOSE = "propose"  # 生成 proposal，等用户 HITL 确认
    RUN_FUNCTION = "run_function"  # SANDBOX-01
    EVALUATE_OBJECTSET = "evaluate_object_set"  # KERNEL-01


@dataclass(frozen=True, slots=True)
class PlanStep:
    step_id: str
    kind: StepKind
    target: str  # agent role name | ActionType rid | Function rid | ObjectSet ...
    payload: tuple[tuple[str, Any], ...] = field(default_factory=tuple)
    requires_hitl: bool = False


@dataclass(frozen=True, slots=True)
class PlanSpec:
    plan_id: str
    author_user_id: str
    steps: tuple[PlanStep, ...]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if not self.steps:
            raise ValueError("PlanSpec.steps must be non-empty")
        # B3 ≥1 HITL（决策点）
        if not any(s.requires_hitl for s in self.steps):
            raise ValueError(
                "PlanSpec must include at least one HITL step (decision B3)"
            )


class StepStatus(str, Enum):
    PENDING = "pending"
    PROPOSED = "proposed"
    HITL_WAITING = "hitl_waiting"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass(frozen=True, slots=True)
class StepResult:
    step_id: str
    status: StepStatus
    output: Any = None
    error: str | None = None


@dataclass
class PlanState:
    plan: PlanSpec
    current_step_idx: int = 0
    history: list[StepResult] = field(default_factory=list)
    aborted: bool = False

    @property
    def current_step(self) -> PlanStep | None:
        if self.aborted or self.current_step_idx >= len(self.plan.steps):
            return None
        return self.plan.steps[self.current_step_idx]


class SuperAIOrchestrator:
    """Plan 解析 + 调度（无 LLM 依赖 —— 由 AGENT-* Batch 实现 run_step）。"""

    def __init__(self) -> None:
        self._plans: dict[str, PlanState] = {}

    def submit(self, spec: PlanSpec) -> PlanState:
        if spec.plan_id in self._plans:
            raise ValueError(f"plan already exists: {spec.plan_id}")
        state = PlanState(plan=spec)
        self._plans[spec.plan_id] = state
        return state

    def get(self, plan_id: str) -> PlanState:
        s = self._plans.get(plan_id)
        if s is None:
            raise KeyError(f"plan not found: {plan_id}")
        return s

    def record(self, plan_id: str, result: StepResult) -> PlanState:
        s = self.get(plan_id)
        s.history.append(result)
        if result.status == StepStatus.HITL_WAITING:
            # 等用户确认后由 resume() 推进
            return s
        if result.status in (StepStatus.COMPLETED, StepStatus.SKIPPED):
            s.current_step_idx += 1
        elif result.status == StepStatus.FAILED:
            s.aborted = True
        return s

    def abort(self, plan_id: str, reason: str = "") -> PlanState:
        s = self.get(plan_id)
        s.aborted = True
        s.history.append(StepResult(
            step_id="",
            status=StepStatus.FAILED,
            error=f"aborted: {reason}",
        ))
        return s

    @staticmethod
    def new_plan_id() -> str:
        return uuid.uuid4().hex


# ──────────────────── 简易 Builder（数字员工选择） ────────────────────


class AgentSelector:
    """根据 step.target 选择合适的数字员工（heuristic；AGENT-*-01 之后接 LLM）。"""

    # 命名空间映射（rid prefix → agent role）
    _RID_TO_ROLE: tuple[tuple[str, AgentRole], ...] = (
        ("ont.", AgentRole.ONTOLOGY),
        ("wfe.", AgentRole.WORKFLOW),
        ("app.", AgentRole.APP),
        ("data.", AgentRole.DATA_PRODUCT),
        ("obs.", AgentRole.OBS),
        ("sec.", AgentRole.SECURITY),
        ("kb.", AgentRole.KNOWLEDGE),
    )

    def select(self, target: str) -> AgentRole:
        # 默认 SUPERAI 处理 fallback
        for prefix, role in self._RID_TO_ROLE:
            if target.startswith(prefix):
                return role
        return AgentRole.SUPERAI


__all__ = [
    "AgentRole",
    "StepKind",
    "PlanStep",
    "PlanSpec",
    "StepStatus",
    "StepResult",
    "PlanState",
    "SuperAIOrchestrator",
    "AgentSelector",
]