"""超级大脑的任务图（1.0 主链）。

形状（刻意保持一条直线 + 一层并行，见 1.0 边界）：

    START → plan ──(Send 扇出)──→ worker × N ──→ gate ──┬→ summarize → END
                                                        └→ reject    → END

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

from .planner import PlanError, Planner
from .runtime import EmployeeRuntime
from .state import BrainState


def _fan_out(state: BrainState) -> list[Send]:
    """把拆好的子任务并行派出去——每个子任务一个 worker 实例。"""
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
        for subtask in state.get("subtasks", [])
    ]


def _route_after_gate(state: BrainState) -> str:
    if state.get("approved") is True:
        return "summarize"
    if state.get("approved") is False:
        return "reject"
    return END


def build_brain_graph(
    *,
    planner: Planner,
    runtime: EmployeeRuntime,
    checkpointer: BaseCheckpointSaver,
    max_parallel: int = 3,
) -> Any:
    """编译大脑图。依赖（拆解器 / 员工运行时 / 检查点）全部注入，便于替换。"""

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
        return {"subtasks": subtasks, "status": "running", "results": {}}

    async def worker_node(state: dict[str, Any]) -> dict[str, Any]:
        subtask = dict(state["subtask"])
        # 实例身份**按运行唯一**：拆解器每次都给同样的 ``t1``/``t2``/``t3``，
        # 直接拿它当 ``team_task`` 主键，同租户的两次运行就会共用同一行——
        # 上一轮的终态会挡住新一轮（``send`` 误判 409），并发时更糟：两轮
        # **共用同一个信箱**，A 轮的追问会被 B 轮吃掉。
        subtask["team_task_id"] = f"{state['run_id'][:8]}-{subtask['task_id']}"
        result = await runtime.run(subtask=subtask, tenant_id=state["tenant_id"])
        # ``results`` 仍按**计划内标签**归类（``t1``…）：那是计划里的位置，
        # 不是实例身份；调用方要投递时读回执里的 ``team_task_id``。
        return {"results": {subtask["task_id"]: result}}

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
        return {
            "status": "completed",
            "summary": f"目标：{state['goal']}\n" + "\n".join(lines),
        }

    async def reject_node(state: BrainState) -> dict[str, Any]:
        return {"status": "failed", "error": "人工确认未通过，已中止"}

    graph = StateGraph(BrainState)
    graph.add_node("plan", plan_node)
    graph.add_node("worker", worker_node)
    graph.add_node("gate", gate_node)
    graph.add_node("summarize", summarize_node)
    graph.add_node("reject", reject_node)

    graph.add_edge(START, "plan")
    graph.add_conditional_edges("plan", _fan_out, ["worker"])
    graph.add_edge("worker", "gate")
    graph.add_conditional_edges(
        "gate",
        _route_after_gate,
        {"summarize": "summarize", "reject": "reject", END: END},
    )
    graph.add_edge("summarize", END)
    graph.add_edge("reject", END)
    return graph.compile(checkpointer=checkpointer)


__all__ = ["build_brain_graph"]
