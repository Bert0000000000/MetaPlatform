"""1.4 任务 1 · 四维闸门接进**真实执行路径**。

``test_envelope_gate.py`` 验的是闸门本身；这里验的是它**真的被挂在**员工运行时
与脑图派活上——1.3 的毛病正是"判了但没拦"，只测判定函数会把同一个毛病再犯一次。

两条链路：
  * 脑图 ``worker`` 把闸门发放的包络写进子任务（``granted_envelope``）；
  * 员工运行时按那份包络建闸门，越维调用被拒且**不落网**。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team import (
    BrainService,
    EmployeeProfile,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    LlmEmployeeRuntime,
    ProfileRegistry,
    SubTask,
    TeamBus,
)
from mate_tech_agent_team.authority import Envelope
from mate_tech_agent_team.state import SubTaskResult
from mate_tech_agent_team.toolbox import McpToolbox

TENANT = "tenant-acme"


def _admin_token() -> str:
    """发起用户令牌：带够 EMP-ACTOR 的四维授权，否则派活会先转成待授权提案。

    权限标记按 ``tool:`` / ``action:`` / ``kb:`` / ``marking:`` 前缀逐维加到
    角色基线之上（ADR-0066 §3.3），所以这里显式把员工要用的四样都写上。
    """
    import time

    import jwt as pyjwt

    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "attributes": {"tenant_id": [TENANT]},
            "tenant_id": TENANT,
            "permissions": [
                "tool:ont_propose_action",
                "tool:kb_search",
                "action:ont.acme.action.approve-order.v1",
                "kb:kb-orders",
                "marking:internal",
            ],
            "iat": now,
            "exp": now + 3600,
        },
        "test-secret",
        algorithm="HS256",
    )


ADMIN_TOKEN = _admin_token()


class FakeLlm:
    def __init__(self, script: list[dict[str, Any]]) -> None:
        self.script = list(script)
        self.calls: list[dict[str, Any]] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append({"messages": messages, "model": model, "tools": tools})
        if self.script:
            return self.script.pop(0)
        return {"content": "(no more scripted replies)", "tool_calls": []}


class FakeMcp:
    def __init__(self, descriptors: list[dict[str, Any]]) -> None:
        self.descriptors = descriptors
        self.invoked: list[tuple[str, dict[str, Any]]] = []

    async def list_tools(self) -> list[dict[str, Any]]:
        return self.descriptors

    async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> Any:
        self.invoked.append((name, arguments))
        return {"rows": [{"id": f"{name}-row"}]}


def _descriptor(name: str) -> dict[str, Any]:
    return {
        "name": name,
        "description": name,
        "inputSchema": {"type": "object", "properties": {}},
        "agentInvokable": True,
    }


ACTION_TOOL = _descriptor("ont_propose_action")
KB_TOOL = _descriptor("kb_search")

SCRIPTED_CALL = {
    "content": "",
    "tool_calls": [
        {
            "id": "c1",
            "type": "function",
            "function": {
                "name": "ont_propose_action",
                "arguments": '{"action_rid": "ont.acme.action.wipe.v1"}',
            },
        }
    ],
}


def _profile() -> EmployeeProfile:
    return EmployeeProfile(
        profile_id="EMP-ACTOR",
        name="派单员",
        base_role="ontology",
        system_prompt="你是派单员。",
        tools=("ont_propose_action", "kb_search"),
        action_rids=("ont.acme.action.approve-order.v1",),
        kb_ids=("kb-orders",),
        markings=("internal",),
    )


def _runtime(llm: FakeLlm, mcp: FakeMcp) -> LlmEmployeeRuntime:
    return LlmEmployeeRuntime(
        registry=ProfileRegistry([_profile()]),
        llm_factory=lambda _t: llm,
        toolbox_factory=lambda _t: McpToolbox(mcp),
    )


# ── 运行时：按发放的包络建闸门 ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_runtime_rejects_action_outside_the_granted_envelope() -> None:
    """派活闸门发放的包络里没有这个 Action → 拒绝，且**不落网**。"""
    llm = FakeLlm([dict(SCRIPTED_CALL), {"content": "改用可用能力后的结论。", "tool_calls": []}])
    mcp = FakeMcp([ACTION_TOOL, KB_TOOL])
    subtask = SubTask(
        task_id="t1",
        profile_id="EMP-ACTOR",
        instruction="处理一下",
        depends_on=[],
        granted_tools=["ont_propose_action", "kb_search"],
        granted_envelope={
            "tools": ["ont_propose_action", "kb_search"],
            "action_rids": ["ont.acme.action.approve-order.v1"],
            "kb_ids": ["kb-orders"],
            "markings": ["internal"],
        },
    )
    result = await _runtime(llm, mcp).run(subtask=subtask, tenant_id=TENANT)

    assert mcp.invoked == [], f"包络外的 Action 竟然打到了中心：{mcp.invoked}"
    rejected = [t for t in result["tool_calls"] if t["allowed"] is False]
    assert len(rejected) == 1, result["tool_calls"]
    assert rejected[0]["rejected"] == "authority_envelope:action_rids"
    assert result["status"] == "ok"


@pytest.mark.asyncio
async def test_runtime_narrows_kb_search_to_the_granted_envelope() -> None:
    """知识检索收窄到包络内的知识库（不点名时注入包络）。"""
    llm = FakeLlm(
        [
            {
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "kb_search", "arguments": '{"query": "退货"}'},
                    }
                ],
            },
            {"content": "查到了。", "tool_calls": []},
        ]
    )
    mcp = FakeMcp([ACTION_TOOL, KB_TOOL])
    subtask = SubTask(
        task_id="t1",
        profile_id="EMP-ACTOR",
        instruction="查一下退货政策",
        depends_on=[],
        granted_tools=["kb_search"],
        granted_envelope={
            "tools": ["kb_search"],
            "action_rids": [],
            "kb_ids": ["kb-orders"],
            "markings": [],
        },
    )
    await _runtime(llm, mcp).run(subtask=subtask, tenant_id=TENANT)

    assert mcp.invoked == [("kb_search", {"query": "退货", "kb_ids": ["kb-orders"]})]


@pytest.mark.asyncio
async def test_runtime_falls_back_to_the_profile_envelope_without_a_grant() -> None:
    """没走闸门的直调（单测 / 离线）退回**员工自己的**包络——不是空包络。

    空包络会把每一次直调都变成全拒：那是另一种"看起来在拦、实际拦的是所有人"。
    """
    llm = FakeLlm(
        [
            {
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "kb_search", "arguments": '{"query": "退货"}'},
                    }
                ],
            },
            {"content": "查到了。", "tool_calls": []},
        ]
    )
    mcp = FakeMcp([ACTION_TOOL, KB_TOOL])
    subtask = SubTask(task_id="t1", profile_id="EMP-ACTOR", instruction="查", depends_on=[])
    result = await _runtime(llm, mcp).run(subtask=subtask, tenant_id=TENANT)

    assert mcp.invoked == [("kb_search", {"query": "退货", "kb_ids": ["kb-orders"]})]
    assert result["status"] == "ok"


# ── 脑图：闸门发放的包络真的写进子任务 ───────────────────────────────────


class RecordingRuntime:
    """记录每个子任务收到的 ``granted_envelope``。"""

    def __init__(self) -> None:
        self.envelopes: dict[str, Any] = {}

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.envelopes[subtask["task_id"]] = dict(subtask.get("granted_envelope") or {})
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}",
            llm_calls=1,
            source="llm",
            tool_calls=[],
        )


class ScriptedPlanner:
    def __init__(self, subtasks: list[dict[str, Any]]) -> None:
        self._subtasks = subtasks

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del goal, max_parallel, tenant_id
        return [SubTask(**st) for st in self._subtasks]


def _service(runtime: RecordingRuntime) -> BrainService:
    registry = ProfileRegistry([_profile()])
    bus = TeamBus(registry=registry, tasks=InMemoryTeamTasks())
    return BrainService(
        planner_for=lambda ctx: ScriptedPlanner(
            [
                {"task_id": "t1", "profile_id": "EMP-ACTOR", "instruction": "甲"},
                {"task_id": "t2", "profile_id": "EMP-ACTOR", "instruction": "乙"},
            ]
        ),
        runtime_for=lambda ctx: runtime,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=bus,
        artifacts=InMemoryArtifacts(),
    )


@pytest.mark.asyncio
async def test_graph_hands_the_granted_envelope_to_the_runtime() -> None:
    runtime = RecordingRuntime()
    service = _service(runtime)

    await service.start(tenant_id=TENANT, goal="跑两个员工", user_token=ADMIN_TOKEN)

    assert set(runtime.envelopes) == {"t1", "t2"}
    for envelope in runtime.envelopes.values():
        assert envelope["action_rids"] == ["ont.acme.action.approve-order.v1"]
        assert envelope["kb_ids"] == ["kb-orders"]
        assert envelope["markings"] == ["internal"]
        assert "ont_propose_action" in envelope["tools"]


def test_envelope_state_is_a_declared_state_key() -> None:
    """状态键必须显式声明，否则写入被静默丢弃（决策 D-5）。"""
    assert "granted_envelope" in SubTask.__annotations__


def test_envelope_round_trips_from_state() -> None:
    envelope = Envelope(
        tools=frozenset({"a"}),
        action_rids=frozenset({"r"}),
        kb_ids=frozenset({"k"}),
        markings=frozenset({"m"}),
    )
    assert Envelope.of_state(envelope.as_state()) == envelope
