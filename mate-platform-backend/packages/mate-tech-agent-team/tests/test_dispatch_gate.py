"""1.3 轨 1 · 派活加固：闸门接进**真实派活路径**，并让 ``depends_on`` 真的执行。

1.1 把包络衰减与深度闸门建在了 :class:`TeamBus` 上，但脑图的 worker 直接调
运行时（``runtime.run(subtask, tenant)``），**闸门空转**——子员工照样跑，
"权限包络 ⊆ 发起用户"与深度上限一句都没落地。

本文件判定两件事：

1. 派活改走 TeamBus 之后，**越权转 proposal / 跨租户硬拒 / 深度超限硬拒**
   在真实链路上真的发生（而不是只在 TeamBus 的单测里成立）；
2. ``depends_on`` 被 planner 填、被图读——**有依赖的节点必须后跑**。

发起用户的包络从**令牌的角色与标记**解析（ADR-0066 §3.3「包络链的根是发起
用户」）：没有令牌就建立不起链根，包络为空（fail-closed）。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest
from mate_tech_agent_team import (
    BrainService,
    Envelope,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    Planner,
    ProfileRegistry,
    SubTask,
    SubTaskResult,
    TeamBus,
    builtin_profiles,
    resolve_initiator_envelope,
)
from mate_tech_agent_team.profiles import EmployeeProfile

TENANT = "tenant-acme"

#: 自签令牌的密钥与本仓其它套件一致（``INSECURE_SKIP_SIGNATURE=1`` 下不验签，
#: 这里只关心**声明**）。刻意不用 ``from conftest import make_token``：一个
#: session 里收集多个测试包时 ``conftest`` 会解析到别的包去（本仓已踩过）。
_JWT_SECRET = "test-secret"


def _token(
    *,
    tenant_id: str = TENANT,
    roles: list[str] | None = None,
    permissions: list[str] | None = None,
) -> str:
    import jwt as pyjwt

    realm_roles = ["PLATFORM_SUPER_ADMIN"] if roles is None else roles
    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": "u-1",
        "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend",
        "azp": "metaplatform-backend",
        "preferred_username": "u-1",
        "realm_access": {"roles": realm_roles},
        "scope": "platform.read platform.write",
        "tenant_id": tenant_id,
        "roles": realm_roles,
        "iat": now,
        "exp": now + 3600,
    }
    if permissions is not None:
        claims["permissions"] = permissions
    return pyjwt.encode(claims, _JWT_SECRET, algorithm="HS256")


#: 租户自建员工：带一个**内置员工都没有**的工具（ADR-0066 §3.4 的"调一个
#: 未授权的 A2A"正是这个场景）。
EXTRA_TOOL = "a2a_invoke"
EMP_EXT = EmployeeProfile(
    profile_id="EMP-EXT",
    name="外呼员工",
    base_role="ontology",
    system_prompt="你是外呼员工。",
    tools=(EXTRA_TOOL,),
)

ADMIN_TOKEN = _token()


def _registry() -> ProfileRegistry:
    return ProfileRegistry([*builtin_profiles(), EMP_EXT])


def _bus(registry: ProfileRegistry | None = None, *, max_depth: int = 3) -> TeamBus:
    return TeamBus(
        registry=registry or _registry(),
        max_depth=max_depth,
        tasks=InMemoryTeamTasks(),
    )


class ScriptedPlanner:
    """按脚本出子任务（含 depends_on / tool_scope），供图级用例驱动。"""

    def __init__(self, subtasks: list[dict[str, Any]]) -> None:
        self._subtasks = subtasks

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del goal, max_parallel, tenant_id
        return [SubTask(**st) for st in self._subtasks]


class OrderRecordingRuntime:
    """记录每个子任务的**起止顺序**与并发度，用来判定 depends_on 真的生效。"""

    def __init__(self, *, delay: float = 0.02) -> None:
        self.events: list[tuple[str, str]] = []
        self.granted: dict[str, list[str]] = {}
        self.active = 0
        self.max_active = 0
        self.delay = delay

    async def run(self, *, subtask, tenant_id: str) -> SubTaskResult:
        task_id = subtask["task_id"]
        self.granted[task_id] = list(subtask.get("granted_tools") or [])
        self.events.append((task_id, "start"))
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            await asyncio.sleep(self.delay)
        finally:
            self.active -= 1
        self.events.append((task_id, "end"))
        return SubTaskResult(
            task_id=task_id,
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
            tool_calls=[],
        )

    def started(self) -> list[str]:
        return [task_id for task_id, phase in self.events if phase == "start"]

    def ended(self) -> list[str]:
        return [task_id for task_id, phase in self.events if phase == "end"]


def _service(
    planner: Planner,
    runtime: OrderRecordingRuntime,
    *,
    bus: TeamBus | None = None,
) -> BrainService:
    return BrainService(
        planner_for=lambda _ctx: planner,
        runtime_for=lambda _ctx: runtime,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=bus or _bus(),
    )


def _flat(profile_ids: list[str], **extra: Any) -> list[dict[str, Any]]:
    return [
        {"task_id": f"t{i + 1}", "profile_id": pid, "instruction": f"做第 {i + 1} 件事", **extra}
        for i, pid in enumerate(profile_ids)
    ]


# ── 判据 1：闸门在真实派活路径上（不再是"假安心"）────────────────────────


@pytest.mark.asyncio
async def test_escalating_dispatch_becomes_proposal_and_never_runs() -> None:
    """越权派活 → 转 proposal，**且不执行**（授权只限本次任务，未批就没有权限）。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "分析"},
            {"task_id": "t2", "profile_id": "EMP-EXT", "instruction": "外呼"},
        ]
    )
    service = _service(planner, runtime)

    state = await service.start(tenant_id=TENANT, goal="分析并外呼", user_token=ADMIN_TOKEN)

    # 越权那一个**没有被执行**——闸门不是装饰
    assert runtime.started() == ["t1"], runtime.started()
    escalated = state["results"]["t2"]
    assert escalated["status"] == "rejected"
    assert escalated["error_code"] == "E_AUTHORITY_ESCALATION"
    assert escalated["proposal"]["escalations"] == ["tools"]
    assert escalated["proposal"]["requested"] == {"tools": [EXTRA_TOOL]}
    assert escalated["proposal"]["scope"] == "this_task_only"
    # 收窄/持平的另一个照常执行
    assert state["results"]["t1"]["status"] == "ok"


@pytest.mark.asyncio
async def test_explicit_grant_in_token_lets_the_dispatch_through() -> None:
    """令牌里带 ``tool:a2a_invoke`` 标记 → 包络覆盖该工具 → 免审直接跑。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "先看盘"},
            {"task_id": "t2", "profile_id": "EMP-EXT", "instruction": "外呼"},
        ]
    )
    service = _service(planner, runtime)
    token = _token(permissions=[f"tool:{EXTRA_TOOL}"])

    state = await service.start(tenant_id=TENANT, goal="外呼", user_token=token)

    assert runtime.started() == ["t1", "t2"]
    assert state["results"]["t2"]["status"] == "ok"


@pytest.mark.asyncio
async def test_cross_tenant_profile_is_hard_rejected() -> None:
    """跨租户（员工不在本租户名册）→ 硬拒，不是 proposal。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "自家员工"},
            {"task_id": "t2", "profile_id": "EMP-NOT-MINE", "instruction": "越界"},
        ]
    )
    service = _service(planner, runtime)

    state = await service.start(tenant_id=TENANT, goal="越界", user_token=ADMIN_TOKEN)
    result = state["results"]["t2"]

    assert runtime.started() == ["t1"]
    assert result["error_code"] == "E_PROFILE_NOT_FOUND"
    assert result["proposal"] == {}


@pytest.mark.asyncio
async def test_depth_exceeded_is_hard_rejected() -> None:
    """嵌套层数超上限 → 硬拒（proposal 换不来一个"根本不允许"的深度）。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(_flat(["EMP-ANALYST", "EMP-AUDITOR"]))
    service = _service(planner, runtime, bus=_bus(max_depth=0))

    state = await service.start(tenant_id=TENANT, goal="越界深度", user_token=ADMIN_TOKEN)

    assert runtime.started() == []
    assert state["results"]["t1"]["error_code"] == "E_DEPTH_EXCEEDED"
    assert state["results"]["t2"]["error_code"] == "E_DEPTH_EXCEEDED"


@pytest.mark.asyncio
async def test_hard_rejection_fails_the_run() -> None:
    """硬拒不是"这一件没干成"——整轮不该被汇总成 completed。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "分析"},
            {"task_id": "t2", "profile_id": "EMP-NOT-MINE", "instruction": "越界"},
        ]
    )
    service = _service(planner, runtime)

    run = await service.start(tenant_id=TENANT, goal="越界", user_token=ADMIN_TOKEN)
    done = await service.resume(
        tenant_id=TENANT, run_id=run["run_id"], approved=True, user_token=ADMIN_TOKEN
    )

    assert done["status"] == "failed"
    assert "E_PROFILE_NOT_FOUND" in done["error"]


@pytest.mark.asyncio
async def test_escalation_alone_does_not_fail_the_run() -> None:
    """越权只是"等授权"，不是失败——其余子任务的产出照常汇总。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "分析"},
            {"task_id": "t2", "profile_id": "EMP-EXT", "instruction": "外呼"},
        ]
    )
    service = _service(planner, runtime)

    run = await service.start(tenant_id=TENANT, goal="分析并外呼", user_token=ADMIN_TOKEN)
    done = await service.resume(
        tenant_id=TENANT, run_id=run["run_id"], approved=True, user_token=ADMIN_TOKEN
    )

    assert done["status"] == "completed"
    assert "EMP-ANALYST" in done["summary"]
    assert "EMP-EXT" in done["summary"]  # 待授权项也要出现在汇总里，不能静默吞掉


@pytest.mark.asyncio
async def test_every_dispatched_subtask_has_a_team_task_row() -> None:
    """派活走 TeamBus 的可见证据：每个子任务在 ``team_task`` 里都有一行。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(_flat(["EMP-ANALYST", "EMP-AUDITOR"]))
    bus = _bus()
    service = _service(planner, runtime, bus=bus)

    state = await service.start(tenant_id=TENANT, goal="给两个角度", user_token=ADMIN_TOKEN)

    for task_id, result in state["results"].items():
        row = await bus.task(task_id=result["team_task_id"], tenant_id=TENANT)
        assert row is not None, f"{task_id} 没有 team_task 行 → 追问必然 404"


@pytest.mark.asyncio
async def test_tool_scope_narrows_what_the_employee_may_call() -> None:
    """``tool_scope`` 只能收窄：收窄后的工具面要**真的**落到运行时。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {
                "task_id": "t1",
                "profile_id": "EMP-ANALYST",
                "instruction": "只看类型清单",
                "tool_scope": ["ont_list_classes"],
            },
            {"task_id": "t2", "profile_id": "EMP-AUDITOR", "instruction": "照常"},
        ]
    )
    service = _service(planner, runtime)

    state = await service.start(tenant_id=TENANT, goal="收窄", user_token=ADMIN_TOKEN)

    assert state["results"]["t1"]["status"] == "ok"
    assert runtime.granted["t1"] == ["ont_list_classes"]
    # 没收窄的那个照旧拿满白名单
    assert "ont_object_query" in runtime.granted["t2"]


# ── 判据 2：depends_on 真的执行 ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_dependent_node_runs_after_its_dependency() -> None:
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "先查"},
            {
                "task_id": "t2",
                "profile_id": "EMP-AUDITOR",
                "instruction": "再核",
                "depends_on": ["t1"],
            },
            {
                "task_id": "t3",
                "profile_id": "EMP-RESEARCHER",
                "instruction": "最后补背景",
                "depends_on": ["t2"],
            },
        ]
    )
    service = _service(planner, runtime)

    await service.start(tenant_id=TENANT, goal="有依赖的链", user_token=ADMIN_TOKEN)

    assert runtime.started() == ["t1", "t2", "t3"], runtime.events
    # 后跑的必须等前一个**结束**之后才开始
    assert runtime.events.index(("t1", "end")) < runtime.events.index(("t2", "start"))
    assert runtime.events.index(("t2", "end")) < runtime.events.index(("t3", "start"))


@pytest.mark.asyncio
async def test_independent_nodes_still_run_in_parallel_within_a_wave() -> None:
    """有依赖不等于串行：同一波里互不依赖的节点仍要并行。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "甲"},
            {"task_id": "t2", "profile_id": "EMP-AUDITOR", "instruction": "乙"},
            {
                "task_id": "t3",
                "profile_id": "EMP-RESEARCHER",
                "instruction": "合并",
                "depends_on": ["t1", "t2"],
            },
        ]
    )
    service = _service(planner, runtime)

    await service.start(tenant_id=TENANT, goal="两波", user_token=ADMIN_TOKEN)

    assert runtime.max_active >= 2, "同一波的并行被 depends_on 的实现压成了串行"
    assert runtime.events.index(("t1", "end")) < runtime.events.index(("t3", "start"))
    assert runtime.events.index(("t2", "end")) < runtime.events.index(("t3", "start"))


@pytest.mark.asyncio
async def test_dependency_on_unknown_node_fails_the_plan() -> None:
    """依赖指向计划里不存在的节点 = 永远等不到 → 计划期直接判失败。"""
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "甲"},
            {
                "task_id": "t2",
                "profile_id": "EMP-AUDITOR",
                "instruction": "乙",
                "depends_on": ["t9"],
            },
        ]
    )
    service = _service(planner, runtime)

    state = await service.start(tenant_id=TENANT, goal="悬空依赖", user_token=ADMIN_TOKEN)

    assert state["status"] == "failed"
    assert "t9" in state["error"]
    assert runtime.started() == []


@pytest.mark.asyncio
async def test_dependency_cycle_fails_the_plan() -> None:
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(
        [
            {
                "task_id": "t1",
                "profile_id": "EMP-ANALYST",
                "instruction": "甲",
                "depends_on": ["t2"],
            },
            {
                "task_id": "t2",
                "profile_id": "EMP-AUDITOR",
                "instruction": "乙",
                "depends_on": ["t1"],
            },
        ]
    )
    service = _service(planner, runtime)

    state = await service.start(tenant_id=TENANT, goal="环", user_token=ADMIN_TOKEN)

    assert state["status"] == "failed"
    assert runtime.started() == []


# ── 判据：发起用户包络从令牌解析 ─────────────────────────────────────────


def test_admin_role_gets_the_builtin_ceiling() -> None:
    envelope = resolve_initiator_envelope(_token())
    for profile in builtin_profiles():
        assert Envelope.of(profile).is_subset_of(envelope), profile.profile_id
    # 内置员工都没有的第三方能力，管理员也不自动拥有
    assert EXTRA_TOOL not in envelope.tools


def test_explicit_permissions_extend_the_envelope_by_dimension() -> None:
    token = _token(
        roles=["platform_user"],
        permissions=["tool:a2a_invoke", "action:ont.create_link", "kb:kb-orders", "marking:x"],
    )
    envelope = resolve_initiator_envelope(token)

    assert EXTRA_TOOL in envelope.tools
    assert envelope.action_rids == frozenset({"ont.create_link"})
    assert envelope.kb_ids == frozenset({"kb-orders"})
    assert envelope.markings == frozenset({"x"})


def test_missing_token_means_no_authority_at_all() -> None:
    """链根建立不起来 = 没有任何权限（fail-closed），不是"默认全给"。"""
    assert resolve_initiator_envelope("") == Envelope()


@pytest.mark.asyncio
async def test_no_token_means_nothing_is_dispatched() -> None:
    runtime = OrderRecordingRuntime()
    planner = ScriptedPlanner(_flat(["EMP-ANALYST", "EMP-AUDITOR"]))
    service = _service(planner, runtime)

    state = await service.start(tenant_id=TENANT, goal="无令牌")

    assert runtime.started() == []
    assert state["results"]["t1"]["error_code"] == "E_AUTHORITY_ESCALATION"


def test_envelope_round_trips_through_state() -> None:
    """包络要能进图状态（显式 schema），所以得有稳定的 dict 形态。"""
    envelope = Envelope(
        tools=frozenset({"b", "a"}),
        action_rids=frozenset(),
        kb_ids=frozenset({"kb-1"}),
        markings=frozenset(),
    )
    assert Envelope.of_state(envelope.as_state()) == envelope
