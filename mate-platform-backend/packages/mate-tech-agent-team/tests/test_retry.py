"""1.5 任务 4 · 失败重试：策略（次数 / 退避）+ **幂等边界**。

判据两条：

1. **可重试的失败会重试并成功** —— 员工运行时那一次调用抖动（模型 5xx / 网络
   超时这类）时，按策略重试，重试用尽才判这一件没干成；
2. **有副作用的节点不被盲目重跑**（负例）—— 派活（建 ``team_task`` 行 + 落审计
   行）与越权转 proposal 都**只发生一次**。

第 2 条是本文件真正的重点：它正是 1.0 定「不用 ``interrupt()``」的同一个理由
——暂停/恢复（以及重试）都不能把一个**已经产生副作用**的节点再跑一遍。所以
重试只包住"没有副作用的那一段"（运行时调用），派活在循环**外面**。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team import (
    AUDIT_ESCALATION,
    AUDIT_SPAWN,
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    Planner,
    ProfileRegistry,
    RetryPolicy,
    SubTask,
    SubTaskResult,
    TeamBus,
    TransientRunError,
    builtin_profiles,
)
from mate_tech_agent_team.profiles import EmployeeProfile

TENANT = "tenant-acme"

_JWT_SECRET = "test-secret"

#: 带一个内置员工都没有的工具 → 派它一定越权转 proposal（负例要用）。
EXTRA_TOOL = "a2a_invoke"


def _token(*, tenant_id: str = TENANT) -> str:
    import time as _time

    import jwt as pyjwt

    now = int(_time.time())
    return pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "tenant_id": tenant_id,
            "iat": now,
            "exp": now + 3600,
        },
        _JWT_SECRET,
        algorithm="HS256",
    )


ADMIN_TOKEN = _token()

EMP_EXT = EmployeeProfile(
    profile_id="EMP-EXT",
    name="外呼员工",
    base_role="ontology",
    system_prompt="你是外呼员工。",
    tools=(EXTRA_TOOL,),
)


class ScriptedPlanner:
    def __init__(self, subtasks: list[dict[str, Any]]) -> None:
        self._subtasks = subtasks

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del goal, max_parallel, tenant_id
        return [SubTask(**st) for st in self._subtasks]


class FlakyRuntime:
    """只有 ``task_id`` 那一件会抖：前 N 次抛可重试异常，之后成功（或永久失败）。

    其它子任务一次过手——"重试是失败节点自己的事，不牵连别人"要靠它才验得出来。
    """

    def __init__(
        self,
        *,
        task_id: str = "t1",
        transient_failures: int = 0,
        permanent: bool = False,
    ) -> None:
        self.task_id = task_id
        self.transient_failures = transient_failures
        self.permanent = permanent
        self.calls: dict[str, int] = {}

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        name = subtask["task_id"]
        seen = self.calls.get(name, 0) + 1
        self.calls[name] = seen
        if name == self.task_id:
            if seen <= self.transient_failures:
                raise TransientRunError(f"第 {seen} 次调用抖动（模型 5xx）")
            if self.permanent:
                return SubTaskResult(
                    task_id=name,
                    team_task_id=subtask.get("team_task_id", ""),
                    profile_id=subtask["profile_id"],
                    status="error",
                    output="",
                    error="员工不存在",
                    source="llm",
                )
        return SubTaskResult(
            task_id=name,
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
            tool_calls=[],
        )


def _bus() -> TeamBus:
    registry = ProfileRegistry([*builtin_profiles(), EMP_EXT])
    return TeamBus(registry=registry, tasks=InMemoryTeamTasks())


def _service(
    planner: Planner,
    runtime: FlakyRuntime,
    *,
    bus: TeamBus | None = None,
    policy: RetryPolicy | None = None,
) -> BrainService:
    # 测试里把退避压成 0：**次数**是要验的语义，等待时长不是。
    return BrainService(
        planner_for=lambda _ctx: planner,
        runtime_for=lambda _ctx: runtime,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=bus or _bus(),
        artifacts=InMemoryArtifacts(),
        retry_policy=policy or RetryPolicy(max_attempts=3, base_delay=0.0),
    )


def _two_tasks(second: str = "EMP-AUDITOR") -> ScriptedPlanner:
    return ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "分析"},
            {"task_id": "t2", "profile_id": second, "instruction": "复核"},
        ]
    )


# ── 判据 1：可重试的失败会重试并成功 ────────────────────────────────────


@pytest.mark.asyncio
async def test_a_transient_failure_is_retried_until_it_succeeds() -> None:
    """抖动两次后成功：这一件照样跑成，回执里如实记下**发起了几次**。"""
    runtime = FlakyRuntime(transient_failures=2)
    service = _service(_two_tasks(), runtime)

    state = await service.start(tenant_id=TENANT, goal="分析本月异常订单", user_token=ADMIN_TOKEN)

    # 主链形状不变：仍然跑到人工确认闸门
    assert state["status"] == "awaiting_approval", state.get("error")
    assert state["results"]["t1"]["status"] == "ok"
    assert runtime.calls["t1"] == 3, "两次抖动后成功 = 真的发起了 3 次"
    assert state["results"]["t1"]["attempts"] == 3
    # 没抖动的那个只跑一次：重试是**失败节点**的事，不牵连别人
    assert runtime.calls["t2"] == 1
    assert state["results"]["t2"]["attempts"] == 1


@pytest.mark.asyncio
async def test_retries_are_bounded_and_land_a_per_task_error() -> None:
    """重试用尽 = 这一件没干成（记 error 回执），**不是**整个请求崩掉。"""
    runtime = FlakyRuntime(transient_failures=99)
    service = _service(_two_tasks(), runtime, policy=RetryPolicy(max_attempts=2, base_delay=0.0))

    state = await service.start(tenant_id=TENANT, goal="分析本月异常订单", user_token=ADMIN_TOKEN)

    assert runtime.calls["t1"] == 2, f"重试次数不受策略约束：{runtime.calls}"
    failed = state["results"]["t1"]
    assert failed["status"] == "error"
    assert failed["error_code"] == "E_RUNTIME_UNAVAILABLE"
    assert failed["attempts"] == 2
    # 另一件照常跑完，整轮不被一件抖动拖垮
    assert state["results"]["t2"]["status"] == "ok"


@pytest.mark.asyncio
async def test_a_permanent_failure_is_not_retried() -> None:
    """确定性失败（员工不存在这类）**不重试**：重试是给"可能这次不行"准备的。"""
    runtime = FlakyRuntime(permanent=True)
    service = _service(_two_tasks(), runtime)

    state = await service.start(tenant_id=TENANT, goal="分析本月异常订单", user_token=ADMIN_TOKEN)

    assert runtime.calls["t1"] == 1, f"确定性失败被重试了：{runtime.calls}"
    assert state["results"]["t1"]["status"] == "error"
    assert state["results"]["t1"]["attempts"] == 1


# ── 判据 2：有副作用的节点不被盲目重跑（负例）──────────────────────────


@pytest.mark.asyncio
async def test_retrying_does_not_dispatch_the_task_again() -> None:
    """重试包住的是**运行时那一次调用**，不是整个节点。

    派活是副作用（建 ``team_task`` 行 + 落审计行）。把重试做在节点级（例如
    langgraph 的节点级 ``RetryPolicy`` 重跑整个节点函数）会变成"重试几次就派活
    几次"——审计账上立刻看得出来。
    """
    bus = _bus()
    runtime = FlakyRuntime(transient_failures=2)
    service = _service(_two_tasks(), runtime, bus=bus)

    state = await service.start(tenant_id=TENANT, goal="分析本月异常订单", user_token=ADMIN_TOKEN)
    assert state["results"]["t1"]["attempts"] == 3  # 真的重试了

    spawns = await bus.audit.records(tenant_id=TENANT, action=AUDIT_SPAWN)
    assert len(spawns) == 2, f"派活行数 = {len(spawns)}，重试把派活也重跑了"
    task_ids = sorted(row.task_id for row in spawns)
    assert task_ids == sorted(
        [state["results"]["t1"]["team_task_id"], state["results"]["t2"]["team_task_id"]]
    ), f"同一个子任务被派了多次：{task_ids}"


@pytest.mark.asyncio
async def test_an_escalated_node_is_not_re_executed() -> None:
    """越权转 proposal 是**已产生的副作用**：它绝不进重试循环，也不重跑。

    "未批就没有权限"——重试一次就多落一行越权审计、多起一个待审提案，等于把
    人审队列灌满。所以这类节点只走一次，且运行时**一次都不碰**。
    """
    bus = _bus()
    runtime = FlakyRuntime(transient_failures=99)  # 若被误重试，调用计数会露馅
    service = _service(_two_tasks(second="EMP-EXT"), runtime, bus=bus)

    state = await service.start(tenant_id=TENANT, goal="分析并外呼", user_token=ADMIN_TOKEN)

    escalated = state["results"]["t2"]
    assert escalated["status"] == "rejected"
    assert escalated["error_code"] == "E_AUTHORITY_ESCALATION"
    assert escalated["proposal"]["scope"] == "this_task_only"
    # 运行时一次都没碰它：越权 = 未执行，与重试无关
    assert "t2" not in runtime.calls, runtime.calls
    # 越权审计**只落一行**（重跑一次就会变两行）
    escalations = await bus.audit.records(tenant_id=TENANT, action=AUDIT_ESCALATION)
    assert len(escalations) == 1, f"越权审计行 = {len(escalations)}，节点被重跑了"


# ── 策略本身 ────────────────────────────────────────────────────────────


def test_the_policy_backs_off_exponentially() -> None:
    policy = RetryPolicy(max_attempts=4, base_delay=0.5)
    assert policy.max_attempts == 4
    assert [policy.delay_for(n) for n in (1, 2, 3)] == [0.5, 1.0, 2.0]


def test_a_policy_must_allow_at_least_one_attempt() -> None:
    with pytest.raises(ValueError, match="attempt"):
        RetryPolicy(max_attempts=0)
