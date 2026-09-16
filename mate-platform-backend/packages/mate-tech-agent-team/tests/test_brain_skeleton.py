"""任务 1 · 大脑骨架的验收用例。

判据（来自 GOAL 任务 1）：
  - 3 个并行子任务全部执行并汇总
  - 换租户互不可见

另含两条决策守卫：
  - D-5：图写过的键必须显式声明，否则被静默丢弃
  - D-4：thread_id 是 ``<租户ID>|<任务ID>`` 形状
"""

from __future__ import annotations

import asyncio

import pytest
from mate_tech_agent_team import (
    BrainService,
    InMemoryCheckpointerProvider,
    RunNotFound,
    StaticPlanner,
    SubTaskResult,
    thread_id_for,
)


class RecordingRuntime:
    """记录被派活的次数与并发度，并产出**与输入不同**的结果。

    产出刻意不是原话回填——回执里带 profile_id 与一段加工后的文本，
    这样"每个员工产出不同"是可断言的（治 D-10 的假回执病）。
    """

    def __init__(self, *, delay: float = 0.05) -> None:
        self.calls: list[str] = []
        self.profiles: list[str] = []
        self.active = 0
        self.max_active = 0
        self.delay = delay

    async def run(self, *, subtask, tenant_id: str) -> SubTaskResult:
        self.calls.append(subtask["task_id"])
        self.profiles.append(subtask["profile_id"])
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            await asyncio.sleep(self.delay)
        finally:
            self.active -= 1
        return SubTaskResult(
            task_id=subtask["task_id"],
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"[{subtask['profile_id']}] 已加工：{subtask['instruction']}",
            llm_calls=1,
            source="llm",
            tool_calls=[],
        )


def _service(runtime: RecordingRuntime | None = None) -> tuple[BrainService, RecordingRuntime]:
    rt = runtime or RecordingRuntime()
    service = BrainService(
        planner=StaticPlanner(),
        runtime=rt,
        checkpointer=InMemoryCheckpointerProvider(),
    )
    return service, rt


# ── 判据 1：3 个并行子任务全部执行并汇总 ──────────────────────────────────


@pytest.mark.asyncio
async def test_three_parallel_subtasks_all_execute() -> None:
    service, rt = _service()
    state = await service.start(tenant_id="tenant-a", goal="把本月的异常订单找出来")
    assert len(state["subtasks"]) == 3, state
    assert sorted(rt.calls) == ["t1", "t2", "t3"], rt.calls
    assert sorted(state["results"]) == ["t1", "t2", "t3"], state["results"]


@pytest.mark.asyncio
async def test_workers_actually_run_in_parallel() -> None:
    """并行不是"循环里 await"——观测到的最大并发必须 ≥2。"""
    service, rt = _service()
    await service.start(tenant_id="tenant-a", goal="分析本月异常订单")
    assert rt.max_active >= 2, f"最大并发只有 {rt.max_active}，说明是串行执行的"


@pytest.mark.asyncio
async def test_summary_aggregates_every_subtask() -> None:
    service, _ = _service()
    run = await service.start(tenant_id="tenant-a", goal="分析本月异常订单")
    assert run["status"] == "awaiting_approval"
    done = await service.resume(tenant_id="tenant-a", run_id=run["run_id"], approved=True)
    assert done["status"] == "completed"
    for task_id in ("t1", "t2", "t3"):
        assert task_id in done["summary"], f"{task_id} 的产出没进汇总：{done['summary']}"


# ── 判据 2：换租户互不可见 ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_other_tenant_cannot_read_the_run() -> None:
    service, _ = _service()
    run = await service.start(tenant_id="tenant-a", goal="甲租户的目标")
    # B 租户拿 A 的 run_id 去查 —— 必须查不到（不泄露存在性）
    with pytest.raises(RunNotFound):
        await service.get(tenant_id="tenant-b", run_id=run["run_id"])


@pytest.mark.asyncio
async def test_same_run_id_under_two_tenants_are_different_states() -> None:
    service, _ = _service()
    a = await service.start(tenant_id="tenant-a", goal="甲的目标")
    b = await service.start(tenant_id="tenant-b", goal="乙的目标")
    got_a = await service.get(tenant_id="tenant-a", run_id=a["run_id"])
    got_b = await service.get(tenant_id="tenant-b", run_id=b["run_id"])
    assert got_a["goal"] == "甲的目标"
    assert got_b["goal"] == "乙的目标"


# ── D-4：thread_id 形状 ──────────────────────────────────────────────────


def test_thread_id_carries_tenant_prefix() -> None:
    assert thread_id_for("tenant-a", "abc123") == "tenant-a|abc123"


def test_thread_id_rejects_pipe_in_tenant() -> None:
    """租户名带 ``|`` 会把前缀约定打穿，必须在入口就拦住。"""
    from mate_tech_agent_team.checkpoint import PgCheckpointerProvider, _guc_statement

    with pytest.raises(ValueError, match="不得含"):
        _guc_statement("bad|tenant")
    assert PgCheckpointerProvider  # 保持导入被使用


# ── D-5：显式字段声明（否则静默丢写入）──────────────────────────────────


@pytest.mark.asyncio
async def test_every_key_the_graph_writes_survives_the_checkpointer() -> None:
    """图写过的键必须都能读回来。

    裸 dict / 漏声明字段时，langgraph 会**静默丢弃**写入——这里逐键断言，
    任何新加的键忘了进 ``BrainState`` 都会在这里红。
    """
    service, _ = _service()
    state = await service.start(tenant_id="tenant-a", goal="分析本月异常订单")
    for key in (
        "run_id",
        "tenant_id",
        "goal",
        "subtasks",
        "results",
        "status",
        "hitl_reason",
    ):
        assert key in state, f"BrainState 漏声明 `{key}` → 写入被静默丢弃（D-5）"
