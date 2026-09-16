"""任务 2 · 双向消息（``team_task.inbox``）—— 验收用例。

判据（来自 GOAL 任务 2）：

1. **运行中 ``send`` → 下一轮迭代边界生效**，且**消费即清空**；
2. **终态 ``send`` → 409**（不隐式起新轮）；
3. **跨租户 ``send`` 被拒**；
4. 子 agent **回问走同一机制反向**（写父任务的 inbox）。

**"下一轮生效"怎么断言才算数**：不是"send 没报错"，而是**下一轮模型调用
收到的消息里真的有那句话**。所以替身网关把每一轮的消息都记下来，断言第 2 轮
（工具轮之后的那轮）看得到它。

**为什么跨租户要报"查无此任务"而不是"无权限"**：报 403 等于承认这个 task_id
存在（存在性泄露）。1.1 的 ``RunNotFound`` 已经是这条口径，这里保持一致。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from mate_tech_agent_team.authority import Envelope
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileNotFound
from mate_tech_agent_team.team_bus import (
    SpawnRequest,
    TaskNotFound,
    TaskTerminal,
    TeamBus,
)
from mate_tech_agent_team.team_task_store import InMemoryTeamTasks

TENANT = "tenant-acme"
OTHER_TENANT = "tenant-other"

PROFILE = EmployeeProfile(
    profile_id="EMP-CHILD",
    name="子员工",
    base_role="ontology",
    system_prompt="你是子员工。",
    tools=("ont_object_query",),
    kb_ids=("kb-orders",),
    markings=("internal",),
)


class _Registry:
    """TeamBus 的名册面（``get(profile_id, tenant_id)``）。"""

    async def get(self, profile_id: str, tenant_id: str = "") -> EmployeeProfile:
        if profile_id != PROFILE.profile_id or tenant_id != TENANT:
            raise ProfileNotFound(profile_id)
        return PROFILE

    async def list(self, tenant_id: str = "") -> list[EmployeeProfile]:
        return [PROFILE] if tenant_id == TENANT else []


def _bus() -> TeamBus:
    return TeamBus(registry=_Registry(), tasks=InMemoryTeamTasks())


async def _spawn(bus: TeamBus, *, depth: int = 1, parent: str | None = None) -> str:
    outcome = await bus.spawn(
        SpawnRequest(
            tenant_id=TENANT,
            profile_id="EMP-CHILD",
            initiator_envelope=Envelope.of(PROFILE),
            instruction="干活",
            depth=depth,
            parent_task_id=parent,
        )
    )
    assert outcome.requires_approval is False, "本用例只关心消息通道，不该被包络闸门拦下"
    return outcome.task_id


# ── 判据 1：运行中 send → 下一轮迭代边界生效 ────────────────────────────


class _MidRunSender:
    """第 1 轮回一个工具调用，并在**运行中途**往任务 inbox 投一条消息。

    第 2 轮（工具轮之后）的模型调用应当看得到那条消息——这就是"下一轮生效"。
    """

    def __init__(self, bus: TeamBus, task_id: str, text: str) -> None:
        self._bus = bus
        self._task_id = task_id
        self._text = text
        self.calls: list[list[dict[str, Any]]] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append(messages)
        if len(self.calls) == 1:
            await self._bus.send(
                task_id=self._task_id, tenant_id=TENANT, message=self._text, sender="user"
            )
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
        return {"content": "收到补充，结论已修正。", "tool_calls": []}


def _text_of(messages: list[dict[str, Any]]) -> str:
    return "\n".join(str(m.get("content") or "") for m in messages)


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


def _runtime(gateway: Any, bus: TeamBus):
    from mate_tech_agent_team import LlmEmployeeRuntime, ProfileRegistry
    from mate_tech_agent_team.toolbox import McpToolbox

    return LlmEmployeeRuntime(
        registry=ProfileRegistry([PROFILE]),
        llm_factory=lambda _t: gateway,
        toolbox_factory=lambda _t: McpToolbox(_NoopMcp()),
        inbox_for=lambda tenant_id, task_id: bus.consume_inbox(
            task_id=task_id, tenant_id=tenant_id
        ),
    )


@pytest.mark.asyncio
async def test_send_while_running_is_seen_at_the_next_iteration() -> None:
    bus = _bus()
    task_id = await _spawn(bus)
    gateway = _MidRunSender(bus, task_id, "补充：口径要含已退单。")

    result = await _runtime(gateway, bus).run(
        subtask={"task_id": task_id, "profile_id": "EMP-CHILD", "instruction": "分析订单"},
        tenant_id=TENANT,
    )

    assert result["status"] == "ok", result.get("error")
    assert len(gateway.calls) >= 2, "只有一轮模型调用，工具轮之后的边界没跑到"
    assert "口径要含已退单" in _text_of(gateway.calls[1]), (
        "下一轮模型调用没看到运行中投递的消息 —— 消息没在迭代边界被消费"
    )
    # 消费即清空
    assert await bus.consume_inbox(task_id=task_id, tenant_id=TENANT) == []


@pytest.mark.asyncio
async def test_inbox_is_consumed_and_cleared_not_replayed() -> None:
    """同一批消息**只**在下一轮出现一次，不会每轮重复回灌。"""
    bus = _bus()
    task_id = await _spawn(bus)
    gateway = _MidRunSender(bus, task_id, "只该出现一次的消息。")

    await _runtime(gateway, bus).run(
        subtask={"task_id": task_id, "profile_id": "EMP-CHILD", "instruction": "分析订单"},
        tenant_id=TENANT,
    )

    seen = [i for i, call in enumerate(gateway.calls) if "只该出现一次的消息" in _text_of(call)]
    assert seen == [1], f"消息出现轮次不对（会重复回灌）：{seen}"


# ── 判据 2：终态 send → 409 ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_send_to_terminal_task_is_rejected_as_conflict() -> None:
    bus = _bus()
    task_id = await _spawn(bus)
    await bus.finish(task_id=task_id, tenant_id=TENANT, status="completed")

    with pytest.raises(TaskTerminal) as excinfo:
        await bus.send(task_id=task_id, tenant_id=TENANT, message="还在吗？")

    assert excinfo.value.task_id == task_id
    assert excinfo.value.status == "completed"


@pytest.mark.asyncio
async def test_terminal_task_does_not_implicitly_start_a_new_round() -> None:
    """终态之后再投递**不会**把任务拉回 running。"""
    bus = _bus()
    task_id = await _spawn(bus)
    await bus.finish(task_id=task_id, tenant_id=TENANT, status="failed")

    with pytest.raises(TaskTerminal):
        await bus.send(task_id=task_id, tenant_id=TENANT, message="重开一轮")

    task = await bus.task(task_id=task_id, tenant_id=TENANT)
    assert task is not None and task.status == "failed"
    assert list(task.inbox) == [], "终态任务不该攒下任何待消费消息"


# ── 判据 3：跨租户被拒 ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_send_across_tenants_is_rejected() -> None:
    bus = _bus()
    task_id = await _spawn(bus)

    with pytest.raises(TaskNotFound):
        await bus.send(task_id=task_id, tenant_id=OTHER_TENANT, message="越租户投递")

    # 真正的租户这边信箱仍然是空的 —— 越权投递一个字节都没落进去
    assert await bus.consume_inbox(task_id=task_id, tenant_id=TENANT) == []


@pytest.mark.asyncio
async def test_consume_across_tenants_is_rejected() -> None:
    bus = _bus()
    task_id = await _spawn(bus)
    await bus.send(task_id=task_id, tenant_id=TENANT, message="本租户消息")

    with pytest.raises(TaskNotFound):
        await bus.consume_inbox(task_id=task_id, tenant_id=OTHER_TENANT)


# ── 判据 4：子 agent 回问走同一机制反向 ────────────────────────────────


@pytest.mark.asyncio
async def test_subagent_can_ask_the_parent_through_the_same_channel() -> None:
    """回问就是"往父任务的 inbox 写"——同一条通道，方向相反。"""
    bus = _bus()
    parent_id = await _spawn(bus, depth=0)
    child_id = await _spawn(bus, depth=1, parent=parent_id)

    await bus.send(
        task_id=parent_id,
        tenant_id=TENANT,
        message="父级，订单口径要含已退单吗？",
        sender=child_id,
    )

    pending = await bus.consume_inbox(task_id=parent_id, tenant_id=TENANT)
    assert [m.text for m in pending] == ["父级，订单口径要含已退单吗？"]
    assert pending[0].sender == child_id, "回问要能看出是谁问的"

    # 子任务自己的信箱没被串到
    assert await bus.consume_inbox(task_id=child_id, tenant_id=TENANT) == []


# ── 落库 + RLS（PG 不可用时 skip，不是 fail）────────────────────────────


@pytest.mark.asyncio
async def test_team_task_rows_are_tenant_isolated(pg_dsns: tuple[str, str]) -> None:
    """inbox 落 PG 时，租户隔离仍由数据库强制（**必须**用非超级角色断言）。"""
    from mate_tech_agent_team.team_task_store import PgTeamTasks, bootstrap_tasks

    admin_dsn, app_dsn = pg_dsns
    schema = "agent_team_msg_test"
    import psycopg

    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
        # 非 public schema 默认不给 PUBLIC USAGE —— 不授权 mate_app 的话
        # 它的 search_path 会指向一个够不着的 schema，表现为"表不存在"。
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO mate_app")
        conn.execute(f"SET search_path TO {schema}")
        bootstrap_tasks(conn)
    try:
        store = PgTeamTasks(app_dsn, schema=schema)
        await store.create(_team_task("t-acme", TENANT))
        await store.create(_team_task("t-other", OTHER_TENANT))
        await store.append(TENANT, "t-acme", _message("本租户才看得到"))

        # 用 mate_app（非超级、不绕过 RLS）读
        assert [m.text for m in await store.drain(TENANT, "t-acme")] == ["本租户才看得到"]
        assert await store.get(OTHER_TENANT, "t-acme") is None, "跨租户竟然读到了别家的任务"
        assert await store.drain(OTHER_TENANT, "t-acme") == []
    finally:
        with psycopg.connect(admin_dsn, autocommit=True) as conn:
            conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")


def _team_task(task_id: str, tenant_id: str):
    from mate_tech_agent_team.team_task_store import TeamTask

    return TeamTask(task_id=task_id, tenant_id=tenant_id, profile_id="EMP-CHILD")


def _message(text: str):
    from mate_tech_agent_team.team_task_store import ChannelMessage

    return ChannelMessage(sender="user", text=text)


def test_message_serialization_round_trips() -> None:
    from mate_tech_agent_team.team_task_store import ChannelMessage

    message = ChannelMessage(sender="user", text="你好", at="2026-09-16T00:00:00+00:00")
    assert ChannelMessage.from_json(message.to_json()).text == "你好"
    assert json.loads(message.to_json())["sender"] == "user"


# ── HTTP 面：判据里的 409 / 404 是**线上**行为，不只是异常类型 ───────────

BASE = "/api/v1/agent-team"


@pytest.fixture
def bus() -> TeamBus:
    return _bus()


@pytest.fixture
def client(bus: TeamBus):
    from fastapi.testclient import TestClient
    from mate_tech_agent_team.api.app import set_team_bus
    from mate_tech_agent_team.main import create_app

    yield TestClient(create_app(team_bus=bus))
    set_team_bus(None)  # 别把消息通道漏给后面的用例


def _seed_task(bus: TeamBus, status: str = "running") -> str:
    import asyncio

    async def _do() -> str:
        task_id = await _spawn(bus)
        if status != "running":
            await bus.finish(task_id=task_id, tenant_id=TENANT, status=status)
        return task_id

    return asyncio.run(_do())


def test_post_message_requires_authentication(client: Any) -> None:
    assert client.post(f"{BASE}/tasks/task-x/messages", json={"message": "hi"}).status_code == 401


def test_post_message_to_running_task_is_accepted(
    client: Any, bus: TeamBus, auth_headers: dict[str, str]
) -> None:
    task_id = _seed_task(bus)
    response = client.post(
        f"{BASE}/tasks/{task_id}/messages",
        json={"message": "补充口径"},
        headers=auth_headers,
    )
    assert response.status_code == 202, response.text
    assert response.json()["text"] == "补充口径"
    assert response.json()["sender"] == "user"


def test_post_message_to_terminal_task_returns_409(
    client: Any, bus: TeamBus, auth_headers: dict[str, str]
) -> None:
    task_id = _seed_task(bus, status="completed")
    response = client.post(
        f"{BASE}/tasks/{task_id}/messages",
        json={"message": "还在吗"},
        headers=auth_headers,
    )
    assert response.status_code == 409, response.text
    assert response.json()["detail"]["code"] == "E_TASK_TERMINAL"


def test_post_message_across_tenants_returns_404(
    client: Any, bus: TeamBus, other_tenant_headers: dict[str, str]
) -> None:
    """跨租户与不存在同码——报 403 会泄露 task_id 存在性。"""
    task_id = _seed_task(bus)
    response = client.post(
        f"{BASE}/tasks/{task_id}/messages",
        json={"message": "越租户"},
        headers=other_tenant_headers,
    )
    assert response.status_code == 404, response.text
