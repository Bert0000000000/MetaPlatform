"""统一任务 id：脑图的子任务与 ``team_task`` 必须是**同一个 id**。

**为什么这件事是双向消息可用的前提**：1.2 之前，HTTP 的 ``send`` 只能投给
``team_task`` 里存在的 id（没有就 404），而员工是拿脑图给的 ``t1/t2/t3`` 跑的
——两套 id 永不相交，于是"追问正在干活的员工"这条链路**根本指不到人**。

**为什么不能直接用 ``t1``**：``team_task`` 的主键是 ``(tenant_id, task_id)``，
而拆解器每次运行都产出同样的 ``t1/t2/t3``。同租户跑第二次就会**撞上上一次的行**：
上一轮已是终态 → ``send`` 误判 409；更糟的是两次并发运行会**共用同一个信箱**，
A 轮的追问会被 B 轮吃掉。所以执行 id 必须**按运行唯一**。

**为什么结果仍按 ``t1`` 归类**：``t1`` 是**计划内标签**，不是实例身份。
换掉它等于改 API 值、破既有判据，而它对调用方也没意义——
调用方要的是"能投递到的那个 id"，它在回执里单独给。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team import (
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    ProfileRegistry,
    StaticPlanner,
    SubTaskResult,
    TeamBus,
    builtin_profiles,
)
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileNotFound
from mate_tech_agent_team.team_task_store import InMemoryTeamTasks
from mate_tech_agent_team.toolbox import McpToolbox

TENANT = "tenant-acme"

PROFILE = EmployeeProfile(
    profile_id="EMP-CHILD",
    name="子员工",
    base_role="ontology",
    system_prompt="你是子员工。",
    tools=("ont_object_query",),
)


class _Registry:
    """测试名册：自定义的 ``EMP-CHILD`` + 三个内置员工。

    内置的那三个是必需的——脑图侧用 ``StaticPlanner`` 派的就是它们，而 1.3
    轨 1 起派活要**过闸门**，名册里没有 = 跨租户 = 硬拒。
    """

    def __init__(self) -> None:
        self._profiles = {p.profile_id: p for p in [PROFILE, *builtin_profiles()]}

    async def get(self, profile_id: str, tenant_id: str = "") -> EmployeeProfile:
        if tenant_id != TENANT or profile_id not in self._profiles:
            raise ProfileNotFound(profile_id)
        return self._profiles[profile_id]

    async def list(self, tenant_id: str = "") -> list[EmployeeProfile]:
        return list(self._profiles.values()) if tenant_id == TENANT else []


def _bus() -> TeamBus:
    return TeamBus(registry=_Registry(), tasks=InMemoryTeamTasks())


class _NoopMcp:
    async def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "ont_object_query",
                "description": "查询对象",
                "inputSchema": {"type": "object", "properties": {}},
                "agentInvokable": True,
            }
        ]

    async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> Any:
        return {"rows": []}


class _ScriptedGateway:
    """第 1 轮要工具、第 2 轮收结论；记录每轮看到的 messages。"""

    def __init__(self) -> None:
        self.calls: list[list[dict[str, Any]]] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append(messages)
        if len(self.calls) == 1:
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "ont_object_query", "arguments": "{}"},
                    }
                ],
            }
        return {"content": "收到。", "tool_calls": []}


def _runtime(gateway: Any, bus: TeamBus):
    from mate_tech_agent_team import LlmEmployeeRuntime

    return LlmEmployeeRuntime(
        registry=ProfileRegistry([PROFILE]),
        llm_factory=lambda _t: gateway,
        toolbox_factory=lambda _t: McpToolbox(_NoopMcp()),
        channel=bus,
    )


def _subtask(task_id: str = "t1", **extra: Any):
    return {"task_id": task_id, "profile_id": "EMP-CHILD", "instruction": "干活", **extra}


def _text_of(messages: list[dict[str, Any]]) -> str:
    return "\n".join(str(m.get("content") or "") for m in messages)


# ── 判据：员工运行登记出可投递的 team_task_id ────────────────────────────


@pytest.mark.asyncio
async def test_runtime_registers_a_team_task_and_returns_its_id() -> None:
    bus = _bus()
    result = await _runtime(_ScriptedGateway(), bus).run(
        subtask=_subtask(team_task_id="run1-t1"), tenant_id=TENANT
    )

    assert result["status"] == "ok", result.get("error")
    assert result["team_task_id"] == "run1-t1", "回执里必须给出可投递的实例 id"
    task = await bus.task(task_id="run1-t1", tenant_id=TENANT)
    assert task is not None, "运行没有登记 team_task —— send 会 404"


@pytest.mark.asyncio
async def test_task_instance_is_terminal_after_the_run() -> None:
    bus = _bus()
    await _runtime(_ScriptedGateway(), bus).run(
        subtask=_subtask(team_task_id="run1-t1"), tenant_id=TENANT
    )
    task = await bus.task(task_id="run1-t1", tenant_id=TENANT)
    assert task is not None and task.is_terminal, "跑完还挂着 running，终态判据就失效了"


@pytest.mark.asyncio
async def test_send_by_team_task_id_reaches_the_running_employee() -> None:
    """本任务的核心判据：投递到**图给的那个 id**，员工下一轮真的看到。"""
    bus = _bus()
    gateway = _ScriptedGateway()

    async def _send_mid_run() -> None:
        # 第 1 轮工具调用之后，从"外面"投一条进来
        await bus.send(task_id="run1-t1", tenant_id=TENANT, message="补充：口径含已退单。")

    original = gateway.chat_with_tools

    async def _instrumented(*, messages, model, tools=None, temperature=0.7):
        reply = await original(messages=messages, model=model, tools=tools, temperature=temperature)
        if len(gateway.calls) == 1:
            await _send_mid_run()
        return reply

    gateway.chat_with_tools = _instrumented  # type: ignore[method-assign]

    await _runtime(gateway, bus).run(subtask=_subtask(team_task_id="run1-t1"), tenant_id=TENANT)

    assert "口径含已退单" in _text_of(gateway.calls[1]), (
        "按 team_task_id 投递的消息没在下一轮生效 —— 两套 id 还是没接上"
    )


# ── 跨运行隔离：同一个计划标签在不同运行里必须是不同的实例 ─────────────


@pytest.mark.asyncio
async def test_a_rerun_of_the_same_id_starts_clean() -> None:
    """同 id 重跑必须**重置**实例：上一轮的终态与残留消息都不能带进来。

    这是"重置而非 DO NOTHING"那条语义的守卫——留着上一轮的状态，新一轮会
    一开跑就是终态（``send`` 直接 409），且残留消息会被新一轮吃掉。
    """
    bus = _bus()
    await bus.start(task_id="t1", tenant_id=TENANT, profile_id="EMP-CHILD")
    await bus.send(task_id="t1", tenant_id=TENANT, message="上一轮的残留")
    await bus.finish(task_id="t1", tenant_id=TENANT, status="completed")

    gateway = _ScriptedGateway()
    result = await _runtime(gateway, bus).run(subtask=_subtask(task_id="t1"), tenant_id=TENANT)

    assert result["status"] == "ok", f"重跑被上一轮的状态挡住了：{result.get('error')}"
    assert "上一轮的残留" not in _text_of(gateway.calls[0]), (
        "上一轮的消息漏进了新一轮——实例没有被重置"
    )


@pytest.mark.asyncio
async def test_a_message_to_a_finished_run_does_not_leak_into_the_next() -> None:
    """上一轮的 id 收消息必须 409，且**不能**落进下一轮的信箱。"""
    from mate_tech_agent_team.team_bus import TaskTerminal

    bus = _bus()
    await _runtime(_ScriptedGateway(), bus).run(
        subtask=_subtask(team_task_id="run1-t1"), tenant_id=TENANT
    )
    with pytest.raises(TaskTerminal):
        await bus.send(task_id="run1-t1", tenant_id=TENANT, message="迟到的追问")

    await _runtime(_ScriptedGateway(), bus).run(
        subtask=_subtask(team_task_id="run2-t1"), tenant_id=TENANT
    )
    assert await bus.consume_inbox(task_id="run2-t1", tenant_id=TENANT) == []


# ── 图侧：脑图必须给出可按运行唯一、且能投递的 id ────────────────────────


class _ChannelAwareRuntime:
    """走真实 TeamBus 的员工替身（不调模型，只验证 id 与实例生命周期）。"""

    def __init__(self, bus: TeamBus) -> None:
        self._bus = bus
        self.seen: list[str] = []

    async def run(self, *, subtask, tenant_id: str) -> SubTaskResult:
        team_task_id = str(subtask["team_task_id"])
        self.seen.append(team_task_id)
        await self._bus.start(
            task_id=team_task_id, tenant_id=tenant_id, profile_id=subtask["profile_id"]
        )
        await self._bus.finish(task_id=team_task_id, tenant_id=tenant_id, status="completed")
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=team_task_id,
            profile_id=subtask["profile_id"],
            status="ok",
            output="已加工",
            source="llm",
            llm_calls=1,
            tool_calls=[],
        )


def _service(bus: TeamBus):
    rt = _ChannelAwareRuntime(bus)
    return (
        BrainService(
            planner_for=lambda _ctx: StaticPlanner(),
            runtime_for=lambda _ctx: rt,
            checkpointer=InMemoryCheckpointerProvider(),
            team_bus=bus,
            artifacts=InMemoryArtifacts(),
        ),
        rt,
    )


@pytest.mark.asyncio
async def test_brain_run_gives_every_subtask_a_sendable_unique_id(admin_token: str) -> None:
    bus = _bus()
    service, rt = _service(bus)
    state = await service.start(user_token=admin_token, tenant_id=TENANT, goal="分析本月异常订单")

    # 计划内标签不变（既有判据/API 值不回归）
    assert sorted(state["results"]) == ["t1", "t2", "t3"], state["results"]

    ids = {state["results"][k]["team_task_id"] for k in ("t1", "t2", "t3")}
    assert len(ids) == 3, f"三个子任务共用了实例 id：{ids}"
    assert set(rt.seen) == ids

    for team_task_id in ids:
        task = await bus.task(task_id=team_task_id, tenant_id=TENANT)
        assert task is not None, f"{team_task_id} 没登记 —— 调用方 send 会 404"
        assert task.tenant_id == TENANT


@pytest.mark.asyncio
async def test_subtask_ids_carry_the_run_so_two_runs_never_collide(admin_token: str) -> None:
    bus = _bus()
    service, _rt = _service(bus)
    first = await service.start(user_token=admin_token, tenant_id=TENANT, goal="分析本月异常订单")
    second = await service.start(user_token=admin_token, tenant_id=TENANT, goal="分析本月异常订单")

    ids_first = {first["results"][k]["team_task_id"] for k in ("t1", "t2", "t3")}
    ids_second = {second["results"][k]["team_task_id"] for k in ("t1", "t2", "t3")}
    assert not (ids_first & ids_second), f"两次运行撞了实例 id：{ids_first & ids_second}"

    # 第一次运行的 id 仍然只有一个实例（没被第二次覆盖）
    still_first = await bus.task(task_id=sorted(ids_first)[0], tenant_id=TENANT)
    assert still_first is not None and still_first.is_terminal


def test_http_run_response_exposes_the_sendable_id(auth_headers: dict[str, str]) -> None:
    """HTTP 面必须把这个 id 交给调用方——不然它无从知道该往哪投。"""
    from fastapi.testclient import TestClient
    from mate_tech_agent_team.main import create_app

    bus = _bus()
    service, _rt = _service(bus)
    client = TestClient(create_app(service=service, team_bus=bus))
    response = client.post(
        "/api/v1/agent-team/runs",
        json={"goal": "分析本月异常订单"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    for task_id, result in body["results"].items():
        assert result["team_task_id"], f"{task_id} 的回执没给可投递的实例 id"


@pytest.mark.asyncio
async def test_plain_dict_subtask_without_team_task_id_still_works() -> None:
    """兜底：直接调运行时（不经图）时用计划内标签当实例 id。"""
    bus = _bus()
    result = await _runtime(_ScriptedGateway(), bus).run(
        subtask=_subtask(task_id="t9"), tenant_id=TENANT
    )
    assert result["team_task_id"] == "t9"
    assert (await bus.task(task_id="t9", tenant_id=TENANT)) is not None
