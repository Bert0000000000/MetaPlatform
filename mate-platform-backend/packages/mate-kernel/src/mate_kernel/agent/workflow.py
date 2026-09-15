"""AGENT-WF-01: Workflow 数字员工。

7+1 数字员工中的「Workflow 员工」—— 负责把 SuperAI 的 PlanStep.RUN_FUNCTION
桥接到 ActionType.apply 流程上。
- 解析 BPMN-lite 流程定义（节点：Action / Gateway / WaitUser / End）
- 接收 PlanSpec（其中 StepKind.RUN_FUNCTION 步骤 target = flow rid）
- 把流程节点依次调度给 ActionService.apply
- 暂停 / 恢复：WaitUser 节点返回 AWAITING_USER，由 HITL 恢复

M3 范围：内存版流程引擎（不接 Flowable 8.0；Flowable 由 mate-tech-wfe 适配层接）。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from mate_kernel.action.engine import ActionService, SubmissionContext, SubmissionCriteriaFailed
from mate_kernel.agent.orchestrator import AgentSelector
from mate_kernel.manager.protocol import Manager, ManagerContext


class NodeKind(StrEnum):
    START = "start"
    ACTION = "action"
    GATEWAY = "gateway"
    WAIT_USER = "wait_user"  # HITL 暂停
    END = "end"


@dataclass(frozen=True, slots=True)
class FlowNode:
    node_id: str
    kind: NodeKind
    action_rid: str | None = None  # ACTION 节点时填
    expression: str | None = None  # GATEWAY 节点时填（简化：truthy 走 next_true）
    next_true: str | None = None
    next_false: str | None = None
    next: str | None = None  # START / ACTION / END 单链 next


@dataclass(frozen=True, slots=True)
class FlowDefinition:
    flow_rid: str  # wfe.<tenant>.flow.<slug>.v<n>
    nodes: tuple[FlowNode, ...]
    start_node_id: str

    def __post_init__(self) -> None:
        ids = {n.node_id for n in self.nodes}
        if self.start_node_id not in ids:
            raise ValueError(f"start_node_id {self.start_node_id!r} not in nodes")
        for n in self.nodes:
            for ref in (n.next, n.next_true, n.next_false):
                if ref is not None and ref not in ids:
                    raise ValueError(f"node {n.node_id} next refs missing: {ref!r}")


class FlowStatus(StrEnum):
    RUNNING = "running"
    AWAITING_USER = "awaiting_user"
    COMPLETED = "completed"
    ABORTED = "aborted"


@dataclass
class FlowState:
    flow_rid: str
    current_node_id: str
    status: FlowStatus
    history: list[str] = field(default_factory=list)
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    finished_at: datetime | None = None


class WorkflowAgent:
    """Workflow 数字员工 = 流程定义解析 + 调度 ActionService + HITL 状态机。"""

    def __init__(
        self,
        action_service: ActionService,
        selector: AgentSelector | None = None,
        action_type_lookup: Callable[[str], Any] | None = None,
    ) -> None:
        self.actions = action_service
        self.selector = selector or AgentSelector()
        # ADR-0063 S3：解析 ACTION 节点声明的 function_ref 用（传 ActionType rid →
        # ActionType 对象，取不到返回 None）。缺省时 ACTION 节点会 fail-fast，
        # 而不再拿 action_rid 充当 function_ref 占位（那会绕过 Action 声明的函数）。
        self._action_type_lookup = action_type_lookup
        self._states: dict[str, FlowState] = {}

    def _resolve_function_ref(self, action_rid: str) -> str | None:
        """ADR-0063 S3：从 ActionType 解析其声明的 function_ref rid；取不到返回 None。"""
        if self._action_type_lookup is None:
            return None
        try:
            at = self._action_type_lookup(action_rid)
        except Exception:
            return None
        if at is None:
            return None
        ref = getattr(at, "function_ref", None)
        if ref is None:
            return None
        return getattr(ref, "rid", None) or str(ref)

    def start(
        self,
        flow: FlowDefinition,
        ctx: ManagerContext,
        manager: Manager,
        initial_parameters: dict[str, dict[str, object]] | None = None,
    ) -> FlowState:
        initial_parameters = initial_parameters or {}
        state = FlowState(
            flow_rid=flow.flow_rid,
            current_node_id=flow.start_node_id,
            status=FlowStatus.RUNNING,
        )
        self._states[state.flow_rid + ":" + ctx.session_id] = state
        return self._run_until_blocked(flow, state, ctx, manager, initial_parameters)

    def resume(
        self,
        flow: FlowDefinition,
        ctx: ManagerContext,
        manager: Manager,
        parameters_by_node: dict[str, dict[str, object]] | None = None,
    ) -> FlowState:
        parameters_by_node = parameters_by_node or {}
        key = flow.flow_rid + ":" + ctx.session_id
        state = self._states.get(key)
        if state is None:
            raise KeyError(f"no flow state for {key!r}")
        if state.status != FlowStatus.AWAITING_USER:
            raise RuntimeError(f"flow {key!r} not awaiting user")
        return self._run_until_blocked(flow, state, ctx, manager, parameters_by_node)

    def abort(self, flow_rid: str, ctx: ManagerContext, reason: str = "") -> FlowState:
        key = flow_rid + ":" + ctx.session_id
        state = self._states.get(key)
        if state is None:
            raise KeyError(f"no flow state for {key!r}")
        state.status = FlowStatus.ABORTED
        state.finished_at = datetime.now(UTC)
        state.history.append(f"aborted: {reason}")
        return state

    def get_state(self, flow_rid: str, ctx: ManagerContext) -> FlowState:
        key = flow_rid + ":" + ctx.session_id
        s = self._states.get(key)
        if s is None:
            raise KeyError(f"no flow state for {key!r}")
        return s

    # ───── 内部调度 ─────

    def _run_until_blocked(
        self,
        flow: FlowDefinition,
        state: FlowState,
        ctx: ManagerContext,
        manager: Manager,
        parameters_by_node: dict[str, dict[str, object]],
    ) -> FlowState:
        nodes_by_id = {n.node_id: n for n in flow.nodes}
        # 注册 function_ref 占位 —— Workflow 自身就是一个 function；运行时由 M3 sandbox-02 接管
        safety = 0
        while state.status == FlowStatus.RUNNING and safety < 1000:
            safety += 1
            node = nodes_by_id.get(state.current_node_id)
            if node is None:
                state.status = FlowStatus.ABORTED
                state.history.append(f"missing node: {state.current_node_id}")
                break
            state.history.append(f"enter:{node.kind}:{node.node_id}")
            if node.kind == NodeKind.START:
                state.current_node_id = node.next or ""
                continue
            if node.kind == NodeKind.END:
                state.status = FlowStatus.COMPLETED
                state.finished_at = datetime.now(UTC)
                state.history.append("completed")
                break
            if node.kind == NodeKind.ACTION:
                if node.action_rid is None:
                    state.status = FlowStatus.ABORTED
                    state.history.append(f"action node missing action_rid: {node.node_id}")
                    break
                params = parameters_by_node.get(node.node_id, {})
                # ADR-0063 S3：必须解析 ActionType 声明的 function_ref 再 apply ——
                # 此前拿 action_rid 充当 function_ref 占位，等于绕过 Action 声明的
                # 函数（叠加当时的静默兜底才"跑通"）。
                function_ref_rid = self._resolve_function_ref(node.action_rid)
                if function_ref_rid is None:
                    state.status = FlowStatus.ABORTED
                    state.history.append(
                        f"action node {node.node_id}: cannot resolve function_ref "
                        f"for {node.action_rid}（ADR-0063 S3）"
                    )
                    break
                try:
                    self.actions.apply(
                        action_rid=node.action_rid,
                        submission_criteria=(),  # 流程级节点不做 criteria
                        function_ref=function_ref_rid,
                        on_rid=node.action_rid,
                        target_iid=None,
                        parameters=params,
                        side_effects=(),
                        ctx=SubmissionContext(
                            actor=ctx.user_id,
                            sandbox_id="wfe-" + flow.flow_rid,
                            tenant_id=ctx.tenant_id,
                            correlation_id=ctx.session_id,
                        ),
                    )
                except SubmissionCriteriaFailed as e:
                    state.status = FlowStatus.ABORTED
                    state.history.append(f"action failed: {e}")
                    break
                manager.track(
                    kind=__import__(
                        "mate_kernel.manager.protocol", fromlist=["ChangeKind"]
                    ).ChangeKind.APPLY_ACTION,
                    target_rid=node.action_rid,
                    payload={"node": node.node_id, "flow": flow.flow_rid},
                )
                state.current_node_id = node.next or ""
                continue
            if node.kind == NodeKind.GATEWAY:
                # 简化：expression 必须为真名（变量名）—— 从 parameters 读
                expr = (node.expression or "").strip()
                value = parameters_by_node.get("__gateway__", {}).get(expr)
                next_id = node.next_true if value else node.next_false
                if next_id is None:
                    state.status = FlowStatus.ABORTED
                    state.history.append(f"gateway no branch: {node.node_id}")
                    break
                state.current_node_id = next_id
                continue
            if node.kind == NodeKind.WAIT_USER:
                state.status = FlowStatus.AWAITING_USER
                state.history.append(f"awaiting user at {node.node_id}")
                break
        return state


__all__ = [
    "FlowDefinition",
    "FlowNode",
    "FlowState",
    "FlowStatus",
    "NodeKind",
    "WorkflowAgent",
]
