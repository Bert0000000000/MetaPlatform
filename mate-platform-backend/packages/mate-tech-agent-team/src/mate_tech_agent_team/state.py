"""大脑状态 schema —— 显式声明字段（决策 D-5）。

**为什么必须显式声明**：langgraph 的 StateGraph 以 schema 为准做写入合并。
声明成裸 ``dict`` 时，节点返回的未声明键会被**静默丢弃**——表现为"节点跑了、
结果没了"，且不报错。本仓 ``mate-tech-agent`` 的 ``state.py`` 就吃过这个亏
（``guard_blocked`` / ``pending_review`` 等键未声明 → 写入丢失）。

故：所有会被节点写入的键，必须在此显式列出。
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

# ── 状态里的结构化值（用 TypedDict 而非 dataclass：checkpointer 序列化最稳）──


class SubTask(TypedDict, total=False):
    """一个被派出去的子任务（= 派给某个数字员工的一句话）。"""

    task_id: str
    profile_id: str
    instruction: str
    depends_on: list[str]


class SubTaskResult(TypedDict, total=False):
    """子任务回执。``source`` 区分真实执行与假回执，供 D-10 断言使用。"""

    task_id: str
    profile_id: str
    status: str  # ok | error | rejected
    output: str
    tool_calls: list[dict[str, Any]]
    llm_calls: int
    source: str  # "llm" = 真实模型产出；"stub" = 未接线
    error: str


def merge_results(
    left: dict[str, SubTaskResult] | None,
    right: dict[str, SubTaskResult] | None,
) -> dict[str, SubTaskResult]:
    """并行节点写同一个 ``results`` 键时的归并规则（后者覆盖同 task_id）。"""
    return {**(left or {}), **(right or {})}


class BrainState(TypedDict, total=False):
    """超级大脑的图状态。

    ``results`` 带 reducer：并行 worker 节点各自写入自己的子任务回执，
    由 :func:`merge_results` 合并，而不是互相覆盖。
    """

    run_id: str
    tenant_id: str
    goal: str
    subtasks: list[SubTask]
    results: Annotated[dict[str, SubTaskResult], merge_results]
    approved: bool
    status: str  # planning | running | awaiting_approval | completed | failed
    summary: str
    hitl_reason: str
    error: str


__all__ = ["BrainState", "SubTask", "SubTaskResult", "merge_results"]
