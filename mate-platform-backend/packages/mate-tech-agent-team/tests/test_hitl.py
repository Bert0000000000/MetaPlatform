"""任务 4 · 人工确认闸门的验收用例。

判据：跑到闸门停住 → 点确认 → 继续完成，**日志证明前半段没被重跑**。

这就是决策 D-6 的核心断言：``interrupt()`` 会重跑它所在的节点，所以我们用
「闸门条件边走到 END + ``update_state(as_node="gate")`` + ``invoke(None, cfg)``」。
本文件把"没被重跑"变成可数的东西：拆解次数、每个员工的调用次数，恢复前后必须**相等**。
"""

from __future__ import annotations

import pytest
from mate_tech_agent_team import (
    BrainService,
    InMemoryCheckpointerProvider,
    RunNotAwaitingApproval,
    SubTaskResult,
)


class CountingRuntime:
    def __init__(self) -> None:
        self.by_task: dict[str, int] = {}

    async def run(self, *, subtask, tenant_id: str) -> SubTaskResult:
        task_id = subtask["task_id"]
        self.by_task[task_id] = self.by_task.get(task_id, 0) + 1
        return SubTaskResult(
            task_id=task_id,
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{subtask['profile_id']} 的产出（第 {self.by_task[task_id]} 次）",
            source="llm",
            llm_calls=1,
        )


class CountingPlanner:
    def __init__(self) -> None:
        self.calls = 0

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str):
        from mate_tech_agent_team import SubTask

        self.calls += 1
        return [
            SubTask(
                task_id=f"t{i}", profile_id=f"EMP-{i}", instruction=f"子任务 {i}", depends_on=[]
            )
            for i in (1, 2, 3)
        ][:max_parallel]


def _service() -> tuple[BrainService, CountingRuntime, CountingPlanner]:
    runtime = CountingRuntime()
    planner = CountingPlanner()
    service = BrainService(
        planner_for=lambda _ctx: planner,
        runtime_for=lambda _ctx: runtime,
        checkpointer=InMemoryCheckpointerProvider(),
    )
    return service, runtime, planner


@pytest.mark.asyncio
async def test_gate_stops_before_summarizing() -> None:
    service, runtime, _ = _service()
    run = await service.start(tenant_id="tenant-a", goal="目标")

    assert run["status"] == "awaiting_approval"
    assert run["hitl_reason"]
    assert sorted(runtime.by_task) == ["t1", "t2", "t3"], "三个员工都该跑过"
    assert "summary" not in run or not run.get("summary"), "闸门未过，不该有汇总"


@pytest.mark.asyncio
async def test_approval_completes_without_rerunning_anything() -> None:
    """D-6 的核心：恢复后已完成节点的调用次数**不变**。"""
    service, runtime, planner = _service()
    run = await service.start(tenant_id="tenant-a", goal="目标")
    before_runtime = dict(runtime.by_task)
    before_plan_calls = planner.calls

    done = await service.resume(tenant_id="tenant-a", run_id=run["run_id"], approved=True)

    assert done["status"] == "completed"
    assert done["summary"]
    assert runtime.by_task == before_runtime, (
        f"恢复后员工被重跑了：{before_runtime} → {runtime.by_task}"
    )
    assert planner.calls == before_plan_calls, "恢复后拆解被重跑了"


@pytest.mark.asyncio
async def test_rejection_stops_without_summarizing() -> None:
    service, runtime, _ = _service()
    run = await service.start(tenant_id="tenant-a", goal="目标")
    before = dict(runtime.by_task)

    done = await service.resume(tenant_id="tenant-a", run_id=run["run_id"], approved=False)

    assert done["status"] == "failed"
    assert "人工确认未通过" in done["error"]
    assert not done.get("summary")
    assert runtime.by_task == before, "拒绝路径也不该重跑员工"


@pytest.mark.asyncio
async def test_approving_twice_is_refused() -> None:
    service, _, _ = _service()
    run = await service.start(tenant_id="tenant-a", goal="目标")
    await service.resume(tenant_id="tenant-a", run_id=run["run_id"], approved=True)
    with pytest.raises(RunNotAwaitingApproval):
        await service.resume(tenant_id="tenant-a", run_id=run["run_id"], approved=True)


@pytest.mark.asyncio
async def test_gate_node_has_no_side_effects() -> None:
    """闸门是纯路由节点——反复经过它不该产生任何员工调用。"""
    service, runtime, _ = _service()
    run = await service.start(tenant_id="tenant-a", goal="目标")
    after_first_pass = dict(runtime.by_task)

    service2 = BrainService(
        planner_for=lambda _ctx: CountingPlanner(),
        runtime_for=lambda _ctx: runtime,
        checkpointer=service._checkpointer,
    )
    # 同一个检查点器上再查一次状态：只是读，不该触发任何节点
    await service2.get(tenant_id="tenant-a", run_id=run["run_id"])
    assert runtime.by_task == after_first_pass
