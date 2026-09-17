"""1.6 任务 1 · 证据接线（员工工具结果 → 结构化证据 → run 事件流）。

判据（来自 GOAL 任务 1）：

* 员工调本体工具 → 事件流里有**结构化证据**；
* **取不到字段时不产出条目**（负例，防编造）。

**形状必须与 copilot 的 ``_evidence_items`` 一致**（锁死决策）：同一平台里
"证据"只该有一种样子，前端因此只需要认识一套字段。所以本文件既验"有证据"，
也验"证据长什么样"。

**忠实映射**：只对结果里真实存在的字段取证。拿不到身份就**不产出条目**，
而不是拿业务主键或工具名凑一个——那会变成一条指向不存在对象、点进去就 404
的假证据。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    BrainService,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    LlmEmployeeRuntime,
    McpToolbox,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    TeamBus,
)
from mate_tech_agent_team.evidence import evidence_items
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"

#: 本体对象实例的规范身份（copilot 取证时同样优先 ``__rid__``）。
ORDER_RID = "ont.tenant-acme.individual.order.o-1.v1"
ORDER_TYPE_RID = "ont.tenant-acme.object_type.order.v1"

#: copilot ``_evidence_items`` 产出的字段全集——**不多也不少**。
COPILOT_ITEM_KEYS = frozenset({"type", "ref", "objectId", "concept", "fragment"})


def _token(*, tenant_id: str = TENANT) -> str:
    import time

    import jwt as pyjwt

    now = int(time.time())
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
        "test-secret",
        algorithm="HS256",
    )


def _headers(tenant_id: str = TENANT) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(tenant_id=tenant_id)}"}


# ── 替身：本体工具的真实返回形状 ────────────────────────────────────────


class _OntMcp:
    """MCP 中心替身：按工具名回本体形状的结果（与 ontology_proxy 一致）。"""

    def __init__(self, *, empty: bool = False) -> None:
        self._empty = empty
        self.invoked: list[str] = []

    async def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "ont_object_query",
                "description": "结构化 IR 查询本体对象",
                "inputSchema": {"type": "object", "properties": {"source": {"type": "string"}}},
                "agentInvokable": True,
            }
        ]

    async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> Any:
        self.invoked.append(name)
        if self._empty:
            # 工具**成功**了，但结果里没有可取证的身份字段。
            return {"kind": "objects", "rows": [{"amount": 12}], "note": "no rid here"}
        return {
            "kind": "objects",
            "rows": [{"__rid__": ORDER_RID, "amount": 12, "status": "anomaly"}],
            "result_schema": {},
        }


class _OntLlm:
    """先调一次本体工具、拿到结果后给结论——**无状态**，三个员工并发也稳。"""

    def __init__(self) -> None:
        self.calls = 0

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls += 1
        if not tools:
            return {"content": "（无工具可用了）", "tool_calls": []}
        if any(m.get("role") == "tool" for m in messages):
            return {"content": "已基于本体数据给出结论。", "tool_calls": []}
        return {
            "content": "",
            "tool_calls": [
                {
                    "id": f"c{self.calls}",
                    "type": "function",
                    "function": {"name": "ont_object_query", "arguments": "{}"},
                }
            ],
        }


def _runtime(*, empty: bool = False) -> LlmEmployeeRuntime:
    llm = _OntLlm()
    mcp = _OntMcp(empty=empty)
    return LlmEmployeeRuntime(
        registry=ProfileRegistry(),
        llm_factory=lambda _t: llm,
        toolbox_factory=lambda _t: McpToolbox(mcp),
    )


def _subtask() -> SubTask:
    return SubTask(
        task_id="t1", profile_id="EMP-ANALYST", instruction="找出异常订单", depends_on=[]
    )


# ── 形状与忠实映射（单元）────────────────────────────────────────────────


def test_an_object_query_row_becomes_an_evidence_item() -> None:
    items = evidence_items(
        "ont_object_query",
        {"kind": "objects", "rows": [{"__rid__": ORDER_RID, "amount": 12}]},
    )
    assert len(items) == 1
    assert items[0]["type"] == "ONTOLOGY_OBJECT"
    assert items[0]["ref"] == ORDER_RID
    assert items[0]["objectId"] == ORDER_RID
    assert "amount" in str(items[0]["fragment"])


def test_evidence_item_keys_are_exactly_the_copilot_contract() -> None:
    """同一平台里"证据"只有一种样子：字段集必须与 copilot 完全一致。"""
    items = evidence_items(
        "ont_object_query", {"kind": "objects", "rows": [{"__rid__": ORDER_RID}]}
    )
    assert items, "先得有条目，才谈得上形状"
    assert set(items[0]) <= COPILOT_ITEM_KEYS
    assert {"type", "ref"} <= set(items[0])


def test_an_object_type_row_of_list_classes_becomes_a_named_evidence_item() -> None:
    items = evidence_items(
        "ont_list_classes",
        {"count": 1, "classes": [{"rid": ORDER_TYPE_RID, "name": "订单"}]},
    )
    assert items == [{"type": "ONTOLOGY_OBJECT", "ref": ORDER_TYPE_RID, "concept": "订单"}]


def test_a_class_inspection_becomes_a_type_level_evidence_item() -> None:
    """类型级证据**不设** ``objectId``——那是实例标识，拿它调实例接口会 404。

    结果形状取本体的 ``ClassInspectDTO``（``rid`` + ``display_name``）；copilot
    适配层把它叫 ``class_rid``，两个名字都认。
    """
    items = evidence_items("ont_inspect_class", {"rid": ORDER_TYPE_RID, "display_name": "订单"})
    assert len(items) == 1
    assert items[0]["ref"] == ORDER_TYPE_RID
    assert items[0]["concept"] == "订单"
    assert "objectId" not in items[0]

    aliased = evidence_items("ont_inspect_class", {"class_rid": ORDER_TYPE_RID})
    assert [i["ref"] for i in aliased] == [ORDER_TYPE_RID]


def test_an_aggregate_query_becomes_a_metric_evidence_item() -> None:
    items = evidence_items("ont_object_query", {"kind": "aggregates", "rows": [{"count": 7}]})
    assert len(items) == 1
    assert items[0]["type"] == "ONTOLOGY_METRIC"


# ── 负例：取不到字段就不产出条目（防编造）───────────────────────────────


def test_no_identity_no_item() -> None:
    """结果里的行没有 rid → 一条都不产（不许拿业务主键凑一个假 ref）。"""
    assert evidence_items("ont_object_query", {"kind": "objects", "rows": [{"amount": 12}]}) == []


def test_no_rows_no_item() -> None:
    assert evidence_items("ont_object_query", {"kind": "objects", "rows": []}) == []


def test_a_card_without_individual_rid_is_skipped() -> None:
    """语义搜索卡片缺 ``individual_rid`` → 跳过（它没有可寻址的身份）。"""
    assert evidence_items("ont_search_objects", {"cards": [{"class_rid": ORDER_TYPE_RID}]}) == []


def test_a_class_without_a_rid_is_skipped() -> None:
    assert evidence_items("ont_list_classes", {"classes": [{"name": "订单"}]}) == []


def test_an_unmapped_tool_produces_no_item() -> None:
    assert evidence_items("kb_search", {"items": [{"text": "一段知识"}]}) == []


def test_a_result_that_is_not_a_mapping_produces_no_item() -> None:
    assert evidence_items("ont_object_query", {}) == []


# ── 员工运行时：工具结果真的变成回执里的证据 ─────────────────────────────


@pytest.mark.asyncio
async def test_employee_tool_result_becomes_evidence_on_the_receipt() -> None:
    runtime = _runtime()
    result = await runtime.run(subtask=_subtask(), tenant_id=TENANT)

    assert result["status"] == "ok"
    evidence = result["evidence"]
    assert len(evidence) == 1, evidence
    item = evidence[0]
    assert item["type"] == "ONTOLOGY_OBJECT"
    assert item["ref"] == ORDER_RID
    # 外流前必须带上**可寻址 id 与抓取时刻**（copilot 的 emit 侧同样这么做）
    assert item["evidenceId"]
    assert item["capturedAt"].endswith("Z")


@pytest.mark.asyncio
async def test_a_tool_result_without_evidence_fields_leaves_the_receipt_empty() -> None:
    result = await _runtime(empty=True).run(subtask=_subtask(), tenant_id=TENANT)
    assert result["status"] == "ok"
    assert result["evidence"] == []


# ── 随 run 事件流外流 ───────────────────────────────────────────────────


def _steps(body: str) -> list[dict[str, Any]]:
    """把 SSE 正文解析成步骤事件列表。"""
    steps: list[dict[str, Any]] = []
    for block in body.split("\n\n"):
        for line in block.splitlines():
            if line.startswith("data: "):
                payload = json.loads(line[len("data: ") :])
                if payload:
                    steps.append(payload)
    return steps


def _app(*, empty: bool = False) -> TestClient:
    registry = ProfileRegistry()
    bus = TeamBus(registry=registry, tasks=InMemoryTeamTasks())
    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _runtime(empty=empty),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=bus,
    )
    return TestClient(create_app(service=service, team_bus=bus, profile_registry=registry))


def _terminal_run(client: TestClient) -> str:
    """起一轮跑到终态（驳回闸门），事件流才会收流。"""
    run = client.post(f"{BASE}/runs", json={"goal": "找出本月异常订单"}, headers=_headers()).json()
    rejected = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": False}, headers=_headers()
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "failed"
    return str(run["run_id"])


def test_evidence_flows_out_on_the_run_event_stream() -> None:
    client = _app()
    run_id = _terminal_run(client)

    body = client.get(f"{BASE}/runs/{run_id}/events", headers=_headers()).text
    assert "event: step" in body, body[:400]

    evidence = [item for step in _steps(body) for item in step.get("evidence", [])]
    assert evidence, f"事件流里没有结构化证据：{body[:600]}"
    assert {item["type"] for item in evidence} == {"ONTOLOGY_OBJECT"}
    assert {item["ref"] for item in evidence} == {ORDER_RID}
    assert all(item["evidenceId"] for item in evidence)


def test_evidence_is_visible_on_the_run_state_too() -> None:
    """不只是流里有：``GET /runs/{id}`` 的回执里也要看得见（"能查"）。"""
    client = _app()
    run_id = _terminal_run(client)
    state = client.get(f"{BASE}/runs/{run_id}", headers=_headers()).json()

    rows = list(state["results"].values())
    assert rows, state
    assert any(row["evidence"] for row in rows), rows


def test_the_event_stream_stays_evidence_free_when_no_field_can_be_captured() -> None:
    """负例（防编造）：工具成功了但结果里取不到字段 → 一条证据都不该有。"""
    client = _app(empty=True)
    run_id = _terminal_run(client)

    body = client.get(f"{BASE}/runs/{run_id}/events", headers=_headers()).text
    evidence = [item for step in _steps(body) for item in step.get("evidence", [])]
    assert evidence == [], f"取不到字段却编出了证据：{evidence}"
