"""超级大脑的任务图（1.0 主链 + 1.3 轨 1 派活加固）。

形状：**按依赖分波**执行，每波内部并行。

    START → plan ──→ dispatch ──(Send 扇出)──→ worker × N ──→ gather ──┬→ dispatch
                     ▲                                                  └→ gate ─┬→ summarize → END
                     └────────────────────────────────────────────────────────────┘    └→ reject → END

``depends_on`` 为空 = 第一波；依赖全部有回执的节点进入下一波。于是"无依赖的
并行、有依赖的后跑"是同一个机制的两个结果，而不是两套代码。

**派活必须过 :class:`TeamBus`**（闸门在派活入口，不散落各调用点）：
``spawn`` 判包络衰减与深度上限，越权返回提案（**未批就没有权限**，因此不执行），
跨租户 / 深度超限直接硬拒。1.0/1.1 里 worker 直接调运行时，闸门是空转的——
这一段就是那次的修复。

**HITL 用 D-6 的暂停恢复法，不用 ``interrupt()``**：
``interrupt()`` 会重跑它所在节点；本项目要在"跑到闸门停住 → 人确认 → 继续"之间
保证**已完成节点的调用次数不变**，所以暂停 = 让闸门条件边走到 END（图自然结束），
恢复 = ``update_state(as_node="gate")`` + ``invoke(None, cfg)`` 从检查点续跑。
闸门节点本身**不做任何副作用**（不调模型、不调工具），只读状态做路由——
这样重跑它也不会产生重复调用。
"""

from __future__ import annotations

from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from .authority import DepthExceeded, Envelope
from .planner import PlanError, Planner
from .profiles import ProfileNotFound
from .runtime import EmployeeRuntime
from .state import BrainState, SubTask, SubTaskResult
from .team_bus import SpawnRequest, TeamBus

#: 根 run 派出去的子任务层号（根任务 0，它的子员工 1）。
ROOT_DISPATCH_DEPTH = 1

#: 硬拒（不是"等授权"）：出现在任何一个子任务上，整轮就是失败。
HARD_REJECT_CODES = frozenset({"E_DEPTH_EXCEEDED", "E_PROFILE_NOT_FOUND"})


def _failure(subtask: SubTask, code: str, message: str) -> SubTaskResult:
    return SubTaskResult(
        task_id=subtask.get("task_id", ""),
        team_task_id=subtask.get("team_task_id", ""),
        profile_id=subtask.get("profile_id", ""),
        status="error",
        output="",
        source="llm",
        error=message,
        error_code=code,
        proposal={},
    )


def _validate_dependencies(subtasks: list[SubTask]) -> str:
    """依赖必须在计划内、且能拓扑排完。返回错误描述，没问题就是空串。

    依赖是**模型给的**，所以这里是边界校验：指向不存在的标签会让节点永远等
    不到，成环则整波都动不了——两种都必须判失败而不是静默挂住。
    """
    known = {st.get("task_id", "") for st in subtasks}
    for subtask in subtasks:
        for dep in subtask.get("depends_on") or ():
            if dep not in known:
                return f"依赖指向计划里不存在的节点：{dep}"
    remaining = {st.get("task_id", ""): set(st.get("depends_on") or ()) for st in subtasks}
    while remaining:
        ready = [node for node, deps in remaining.items() if not (deps & remaining.keys())]
        if not ready:
            return "依赖成环：" + "、".join(sorted(remaining))
        for node in ready:
            del remaining[node]
    return ""


def build_brain_graph(
    *,
    planner: Planner,
    runtime: EmployeeRuntime,
    bus: TeamBus,
    checkpointer: BaseCheckpointSaver,
    initiator_envelope: Envelope | None = None,
    max_parallel: int = 3,
    depth: int = ROOT_DISPATCH_DEPTH,
) -> Any:
    """编译大脑图。依赖（拆解器 / 员工运行时 / 派活闸门 / 检查点）全部注入。

    ``initiator_envelope`` 是**发起用户**的包络（ADR-0066 §3.3 的链根），刻意
    与令牌一样**不进图状态**：状态会落进 PG，而它是当次调用的授权，用完即散。
    """
    root_envelope = initiator_envelope if initiator_envelope is not None else Envelope()

    def _done(state: BrainState) -> set[str]:
        return set(state.get("results", {}))

    def _ready(state: BrainState) -> list[SubTask]:
        """这一波够格被派出去的节点：自己没回执，且依赖全都有回执。"""
        done = _done(state)
        return [
            subtask
            for subtask in state.get("subtasks", [])
            if subtask.get("task_id", "") not in done
            and all(dep in done for dep in subtask.get("depends_on") or ())
        ]

    def _fan_out(state: BrainState) -> list[Send]:
        tenant_id = state["tenant_id"]
        return [
            Send(
                "worker",
                {
                    "subtask": subtask,
                    "tenant_id": tenant_id,
                    "run_id": state["run_id"],
                },
            )
            for subtask in _ready(state)
        ]

    def _route_after_plan(state: BrainState) -> str:
        # 计划失败（拆不出 / 依赖不成立）时不再派活，图自然结束。
        if state.get("status") == "failed":
            return END
        return "dispatch" if _ready(state) else "gate"

    def _route_after_gather(state: BrainState) -> str:
        return "dispatch" if _ready(state) else "gate"

    def _route_after_gate(state: BrainState) -> str:
        if state.get("approved") is True:
            return "summarize"
        if state.get("approved") is False:
            return "reject"
        return END

    async def plan_node(state: BrainState) -> dict[str, Any]:
        goal = state["goal"]
        try:
            subtasks = await planner.plan(
                goal=goal, max_parallel=max_parallel, tenant_id=state["tenant_id"]
            )
        except PlanError as exc:
            return {"status": "failed", "error": str(exc), "subtasks": []}
        if len(subtasks) < 2:
            return {
                "status": "failed",
                "error": "无法拆出 ≥2 个可并行子任务",
                "subtasks": subtasks,
            }
        invalid = _validate_dependencies(subtasks)
        if invalid:
            return {"status": "failed", "error": invalid, "subtasks": subtasks}
        return {"subtasks": subtasks, "status": "running", "results": {}}

    async def dispatch_node(state: BrainState) -> dict[str, Any]:
        # 扇出节点本身不做事：选择权在 ``_fan_out`` 里（它读 state 算这一波）。
        return {}

    async def worker_node(payload: dict[str, Any]) -> dict[str, Any]:
        subtask = dict(payload["subtask"])
        run_id = payload["run_id"]
        tenant_id = payload["tenant_id"]
        # 实例身份**按运行唯一**：拆解器每次都给同样的 ``t1``/``t2``/``t3``，
        # 直接拿它当 ``team_task`` 主键，同租户的两次运行就会共用同一行——
        # 上一轮的终态会挡住新一轮（``send`` 误判 409），并发时更糟：两轮
        # **共用同一个信箱**，A 轮的追问会被 B 轮吃掉。
        subtask["team_task_id"] = f"{run_id[:8]}-{subtask['task_id']}"
        try:
            outcome = await bus.spawn(
                SpawnRequest(
                    tenant_id=tenant_id,
                    profile_id=subtask["profile_id"],
                    initiator_envelope=root_envelope,
                    instruction=subtask["instruction"],
                    tool_scope=tuple(subtask.get("tool_scope") or ()),
                    depth=depth,
                    task_id=subtask["team_task_id"],
                )
            )
        except DepthExceeded as exc:
            return {
                "results": {subtask["task_id"]: _failure(subtask, "E_DEPTH_EXCEEDED", str(exc))}
            }
        except ProfileNotFound as exc:
            return {
                "results": {subtask["task_id"]: _failure(subtask, "E_PROFILE_NOT_FOUND", str(exc))}
            }
        if outcome.requires_approval:
            # 越权：转 proposal，**不执行**。授权只作用本次任务，未批就没有权限。
            proposal = dict(outcome.proposal or {})
            return {
                "results": {
                    subtask["task_id"]: SubTaskResult(
                        task_id=subtask["task_id"],
                        team_task_id=subtask["team_task_id"],
                        profile_id=subtask["profile_id"],
                        status="rejected",
                        output="",
                        source="llm",
                        error=(
                            "派活越权，已转人工授权提案（授权范围只限本次任务）："
                            + "、".join(outcome.escalations)
                        ),
                        error_code="E_AUTHORITY_ESCALATION",
                        proposal=proposal,
                    )
                }
            }

        # 闸门放行的工具面**就是**运行时能绑的那一份（不是两处各说各话）。
        subtask["granted_tools"] = sorted(outcome.envelope.tools)
        result = await runtime.run(subtask=subtask, tenant_id=tenant_id)
        # ``results`` 仍按**计划内标签**归类（``t1``…）：那是计划里的位置，
        # 不是实例身份；调用方要投递时读回执里的 ``team_task_id``。
        return {"results": {subtask["task_id"]: result}}

    async def gather_node(state: BrainState) -> dict[str, Any]:
        # 汇合点：等这一波全部回来，再决定有没有下一波。
        return {}

    async def gate_node(state: BrainState) -> dict[str, Any]:
        # 纯路由节点：只读状态、写"等人确认"这个事实，不产生外部副作用。
        pending = state.get("approved") is None
        if pending:
            return {
                "status": "awaiting_approval",
                "hitl_reason": f"{len(state.get('results', {}))} 个员工已产出，等待人工确认后汇总",
            }
        return {}

    async def summarize_node(state: BrainState) -> dict[str, Any]:
        results = state.get("results", {})
        lines = [
            f"- {r.get('profile_id', '?')}（{tid}）：{r.get('output', '').strip()}"
            for tid, r in sorted(results.items())
        ]
        summary = f"目标：{state['goal']}\n" + "\n".join(lines)
        rejected = {
            tid: r for tid, r in results.items() if r.get("error_code") in HARD_REJECT_CODES
        }
        if rejected:
            # 硬拒不是"这件没干成"——没有授权路径可走，整轮就是失败。
            codes = sorted({str(r["error_code"]) for r in rejected.values()})
            return {
                "status": "failed",
                "summary": summary,
                "error": "派活被硬拒（无授权路径）：" + "、".join(codes),
            }
        pending = [
            tid for tid, r in results.items() if r.get("error_code") == "E_AUTHORITY_ESCALATION"
        ]
        if pending:
            # 待授权项**必须出现在汇总里**，否则人会以为三个员工都跑完了。
            summary += "\n\n待授权（未执行，需人工同意后才派活）：" + "、".join(sorted(pending))
        return {"status": "completed", "summary": summary}

    async def reject_node(state: BrainState) -> dict[str, Any]:
        return {"status": "failed", "error": "人工确认未通过，已中止"}

    graph = StateGraph(BrainState)
    graph.add_node("plan", plan_node)
    graph.add_node("dispatch", dispatch_node)
    graph.add_node("worker", worker_node)
    graph.add_node("gather", gather_node)
    graph.add_node("gate", gate_node)
    graph.add_node("summarize", summarize_node)
    graph.add_node("reject", reject_node)

    graph.add_edge(START, "plan")
    graph.add_conditional_edges(
        "plan", _route_after_plan, {"dispatch": "dispatch", "gate": "gate", END: END}
    )
    graph.add_conditional_edges("dispatch", _fan_out, ["worker"])
    graph.add_edge("worker", "gather")
    graph.add_conditional_edges(
        "gather", _route_after_gather, {"dispatch": "dispatch", "gate": "gate"}
    )
    graph.add_conditional_edges(
        "gate",
        _route_after_gate,
        {"summarize": "summarize", "reject": "reject", END: END},
    )
    graph.add_edge("summarize", END)
    graph.add_edge("reject", END)
    return graph.compile(checkpointer=checkpointer)


__all__ = ["HARD_REJECT_CODES", "ROOT_DISPATCH_DEPTH", "build_brain_graph"]
