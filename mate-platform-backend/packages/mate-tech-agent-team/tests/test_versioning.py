"""A-6 / `MP-AGENT-VERSIONING-01`：状态 / 图 / 员工定义版本化。

判据（本文件逐条断言）：

1. **状态自带版本** —— 每一轮把四个版本号写进检查点，"这份状态按哪一版写的"从
   状态自身读得出来。
2. **追加是追加** —— 老检查点（没有这四个键）照样读得出来，判定结果不变。
3. **本轮行为不变**（主判据）—— Run 跑到一半有人改了员工定义，**这一轮**继续用
   派活当时那一份：提示词、模型、工具面都还是旧的。
4. **revision 跟着定义走** —— 定义改了 revision 必变，没改必不变；审计行带上它。
5. **恢复后结果一致** —— 中途被杀再续跑，终态与"从没被杀过"的那一轮逐字相同。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest
from mate_tech_agent_team import (
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.api.run_control import RunControl
from mate_tech_agent_team.audit import AUDIT_SPAWN
from mate_tech_agent_team.profiles import EmployeeProfile
from mate_tech_agent_team.versioning import (
    AGENT_RUNTIME_VERSION,
    CHECKPOINT_CODEC_VERSION,
    GRAPH_DEFINITION_VERSION,
    STATE_SCHEMA_VERSION,
    AgentProfileSnapshot,
    profile_for_subtask,
    revision_of,
)

TENANT = "tenant-acme"
SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})


def _profile(**overrides: Any) -> EmployeeProfile:
    base: dict[str, Any] = {
        "profile_id": "EMP-ANALYST",
        "name": "分析员",
        "base_role": "ontology",
        "system_prompt": "你是分析员 v1。",
        "skills": ("sk-a",),
        "tools": ("ont_object_query",),
        "model": "glm-5.3-flash",
    }
    base.update(overrides)
    return EmployeeProfile(**base)


class _MutableStore:
    """一个"随时能被人改"的名册——模拟"Run 跑到一半有人改了员工定义"。"""

    def __init__(self, profile: EmployeeProfile) -> None:
        self.profile = profile

    async def get(self, tenant_id: str, profile_id: str) -> EmployeeProfile | None:
        return self.profile if profile_id == self.profile.profile_id else None

    async def list(self, tenant_id: str) -> list[EmployeeProfile]:
        return [self.profile]


# ── 判据 3 / 4：快照与 revision ─────────────────────────────────────────


def test_the_revision_tracks_the_definition() -> None:
    base = _profile()
    assert revision_of(base) == revision_of(_profile()), "同一份定义必须算出同一个 revision"
    for field, value in (
        ("system_prompt", "你是分析员 v2。"),
        ("model", "glm-5.3-pro"),
        ("tools", ("ont_object_query", "ont_merge_objects")),
        ("skills", ()),
    ):
        assert revision_of(_profile(**{field: value})) != revision_of(base), (
            f"{field} 变了 revision 没变"
        )


def test_the_revision_is_derived_not_stored() -> None:
    """revision 是定义内容的摘要——不依赖存储、不依赖自增号，任何来源都算得出来。"""
    snapshot = AgentProfileSnapshot.capture(_profile())
    assert snapshot.revision == revision_of(_profile())
    assert snapshot.prompt_digest, "提示词摘要要单独留一份，便于比对"
    assert snapshot.revision != snapshot.prompt_digest, "整体定义 ≠ 只看提示词"


@pytest.mark.asyncio
async def test_a_profile_edit_mid_run_does_not_change_this_run() -> None:
    """**主判据**：派活拍下的定义就是这一轮的定义，名册里改了也不影响。"""
    store = _MutableStore(_profile())
    registry = ProfileRegistry([], store=store)
    subtask: SubTask = {
        "task_id": "t2",
        "profile_id": "EMP-ANALYST",
        "instruction": "复核",
        "depends_on": ["t1"],
    }

    v1 = await profile_for_subtask(subtask, registry, TENANT)
    subtask["profile_snapshot"] = AgentProfileSnapshot.capture(v1).as_state()
    assert v1.system_prompt == "你是分析员 v1。"

    # 跑到一半，有人把定义改了（提示词、模型、工具面全换）。
    store.profile = _profile(
        system_prompt="你是分析员 v2（已被改写）。",
        model="glm-5.3-pro",
        tools=("ont_object_query", "ont_merge_objects"),
    )
    live = await registry.get("EMP-ANALYST", TENANT)
    assert live.system_prompt != v1.system_prompt, "前提：定义真的被改了"

    effective = await profile_for_subtask(subtask, registry, TENANT)
    assert effective.system_prompt == "你是分析员 v1。", "本轮跑的是别人刚改过的那一份"
    assert effective.model == "glm-5.3-flash", "模型被换掉了"
    assert effective.tools == ("ont_object_query",), "工具面被换掉了"
    assert not AgentProfileSnapshot.of_state(subtask["profile_snapshot"]).matches(live), (
        "定义变了却报'还是同一份'"
    )


@pytest.mark.asyncio
async def test_without_a_snapshot_the_live_profile_is_used() -> None:
    """老调用方（没带快照）行为与 A-6 之前逐字一致。"""
    store = _MutableStore(_profile(system_prompt="现在的定义"))
    registry = ProfileRegistry([], store=store)
    subtask: SubTask = {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "分析"}

    live = await profile_for_subtask(subtask, registry, TENANT)
    assert live.system_prompt == "现在的定义"


def test_the_snapshot_survives_a_state_round_trip() -> None:
    snapshot = AgentProfileSnapshot.capture(_profile())
    restored = AgentProfileSnapshot.of_state(snapshot.as_state())
    assert restored is not None
    assert restored.revision == snapshot.revision
    assert restored.system_prompt == snapshot.system_prompt
    assert restored.tools == snapshot.tools
    assert restored.authority_envelope.tools == {"ont_object_query"}, "包络也要跟着快照走"


def test_an_unreadable_snapshot_means_no_snapshot() -> None:
    """认不出来就退回名册现值（fail-safe），而不是崩。"""
    for value in (None, {}, {"profile_id": ""}, "garbage", 42):
        assert AgentProfileSnapshot.of_state(value) is None


# ── 判据 1 / 2：状态版本 ────────────────────────────────────────────────


class _SlowRuntime:
    def __init__(self, delay: float = 0.25) -> None:
        self.delay = delay
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.started.append(subtask["task_id"])
        await asyncio.sleep(self.delay)
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _ChainPlanner(StaticPlanner):
    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del max_parallel, tenant_id
        return [
            SubTask(
                task_id="t1", profile_id="EMP-ANALYST", instruction=f"分析：{goal}", depends_on=[]
            ),
            SubTask(
                task_id="t2",
                profile_id="EMP-ANALYST",
                instruction=f"复核：{goal}",
                depends_on=["t1"],
            ),
        ]


def _service(runtime: Any, *, registry: ProfileRegistry | None = None) -> BrainService:
    return BrainService(
        planner_for=lambda _ctx: _ChainPlanner(),
        runtime_for=lambda _ctx: runtime,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(
            registry=registry or ProfileRegistry(),
            tasks=InMemoryTeamTasks(),
        ),
        artifacts=InMemoryArtifacts(),
    )


async def _until(predicate, *, timeout: float = 8.0, interval: float = 0.01):  # type: ignore[no-untyped-def]
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = await predicate()
        if value:
            return value
        await asyncio.sleep(interval)
    return None


async def _has_result(service: BrainService, run_id: str, task_id: str) -> bool:
    state = await service.get(tenant_id=TENANT, run_id=run_id)
    return task_id in (state.get("results") or {})


async def _settle(service: BrainService, run_id: str, *, timeout: float = 8.0) -> dict[str, Any]:
    async def _done() -> dict[str, Any] | None:
        state = await service.get(tenant_id=TENANT, run_id=run_id)
        return state if str(state.get("status", "")) in SETTLED else None

    return await _until(_done, timeout=timeout) or await service.get(
        tenant_id=TENANT, run_id=run_id
    )


@pytest.mark.asyncio
async def test_the_run_records_which_version_wrote_it(admin_token: str) -> None:
    service = _service(_SlowRuntime(delay=0.0))
    state = await service.start(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
    assert state["state_schema_version"] == STATE_SCHEMA_VERSION
    assert state["graph_definition_version"] == GRAPH_DEFINITION_VERSION
    assert state["agent_runtime_version"] == AGENT_RUNTIME_VERSION
    assert state["checkpoint_codec_version"] == CHECKPOINT_CODEC_VERSION


@pytest.mark.asyncio
async def test_the_dispatch_pins_the_profile_snapshot_on_every_subtask(
    admin_token: str,
) -> None:
    """派活那一刻的定义被钉在子任务上——运行时与路由都从它读。"""
    registry = ProfileRegistry([], store=_MutableStore(_profile()))
    service = _service(_SlowRuntime(delay=0.0), registry=registry)
    state = await service.start(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)

    subtasks = state["subtasks"]
    assert subtasks, "没有子任务，用例前提不成立"
    for subtask in subtasks:
        snapshot = subtask.get("profile_snapshot") or {}
        assert snapshot.get("revision"), subtask
        assert snapshot["system_prompt"] == "你是分析员 v1。"
        assert snapshot["tools"] == ["ont_object_query"]
    # 审计行也带上了判定当时那一版（硬规则 #9：事后追责要能指出用的是哪一版）。
    rows = await service.audit.records(tenant_id=TENANT, action=AUDIT_SPAWN)
    assert rows and all(row.agent_profile_revision for row in rows), rows


# ── 判据 5：恢复后结果一致 ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resuming_after_a_kill_yields_the_same_result(admin_token: str) -> None:
    """中途被杀再续跑，终态与"从没被杀过"的那一轮逐字相同。"""
    control_runtime = _SlowRuntime(delay=0.0)
    control = _service(control_runtime)
    control_run = str(
        (
            await RunControl(control).submit(
                tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token
            )
        )["run_id"]
    )
    baseline = await _settle(control, control_run)

    runtime = _SlowRuntime()
    service = _service(runtime)
    knock = RunControl(service)
    run_id = str(
        (await knock.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token))[
            "run_id"
        ]
    )
    assert await _until(lambda: _has_result(service, run_id, "t1")), "第一波没落检查点"
    await knock.shutdown()
    stuck = await service.get(tenant_id=TENANT, run_id=run_id)
    assert stuck["status"] == "running"

    await service.continue_run(tenant_id=TENANT, run_id=run_id)
    resumed = await _settle(service, run_id)

    assert resumed["status"] == baseline["status"]
    assert resumed["results"].keys() == baseline["results"].keys()
    for task_id, receipt in baseline["results"].items():
        assert resumed["results"][task_id]["output"] == receipt["output"], task_id
        assert resumed["results"][task_id]["status"] == receipt["status"], task_id
    # 版本号在续跑之后仍然读得回来（老检查点靠的就是"读不到就取默认"）。
    assert resumed["state_schema_version"] == STATE_SCHEMA_VERSION
