"""MP-SAL 接线：run_agent_loop 的本体工具执行路径。

决策 1 → LLM 选 list_classes（本体工具）→ 执行 → 结果回填历史 →
决策 2 → 基于真实计数给最终回答。验证 SuperAI「查本体不派员工」闭环。
"""

from __future__ import annotations

from typing import Any

import pytest

from mate_app_copilot import agent_loop


class _FakeDecision:
    """按序吐决策（第一轮 ontology 工具调用，第二轮最终回答）。"""

    def __init__(self, decisions: list[dict[str, Any]]) -> None:
        self._decisions = list(decisions)

    def __call__(self, client: Any, **kw: Any) -> Any:
        decision = self._decisions.pop(0)

        async def gen() -> Any:
            yield {"type": "_decision", **decision}

        return gen()


def _onto_call(name: str, args: dict[str, Any], call_id: str = "c1") -> dict[str, Any]:
    import json as _json

    return {
        "content": "",
        "tool_calls": [
            {
                "id": call_id,
                "type": "function",
                "function": {"name": name, "arguments": _json.dumps(args, ensure_ascii=False)},
            }
        ],
    }


async def _collect(agraph: Any) -> list[dict[str, Any]]:
    return [ev async for ev in agraph]


class TestOntologyToolExecution:
    @pytest.mark.asyncio
    async def test_query_answered_without_dispatch(self, monkeypatch: Any) -> None:
        decisions = _FakeDecision(
            [
                _onto_call("list_classes", {}),
                {"content": "系统里有 2 个本体类型：order 和 ledger。", "tool_calls": []},
            ]
        )
        monkeypatch.setattr(agent_loop, "_decision_turn", decisions)

        executed: list[tuple[str, dict]] = []

        def exec_fn(name: str, args: dict) -> dict:
            executed.append((name, args))
            return {"classes": [{"rid": "ont.t.obj.order.v1"}, {"rid": "ont.t.obj.ledger.v1"}]}

        onto_tools = [
            {
                "type": "function",
                "function": {
                    "name": "list_classes",
                    "description": "d",
                    "parameters": {"type": "object", "properties": {}},
                },
            },
        ]

        events = await _collect(
            agent_loop.run_agent_loop(
                llmgw_client=object(),
                orchestrator_client=object(),
                messages=[{"role": "user", "content": "系统里有多少本体"}],
                model="m",
                roles=[{"role": "workflow", "name": "W", "capabilities": []}],
                tenant_id="t",
                ontology_tools=onto_tools,
                ontology_tool_exec=exec_fn,
            )
        )

        assert executed == [("list_classes", {})]
        kinds = [(e["type"], e.get("tool")) for e in events]
        assert ("tool_call", "list_classes") in kinds
        assert kinds[0] != ("tool_result", None)
        tool_results = [e for e in events if e["type"] == "tool_result"]
        assert tool_results and tool_results[0]["status"] == "success"
        assert len(tool_results[0]["result"]["classes"]) == 2
        final = [e for e in events if e["type"] == "final"]
        assert final and "2 个本体" in final[0]["content"]
        # 未触发任何 dispatch（没有 dispatch_employee 工具调用事件）
        assert not any(e.get("tool") == "dispatch_employee" for e in events)

    @pytest.mark.asyncio
    async def test_tool_error_degrades_not_crashes(self, monkeypatch: Any) -> None:
        decisions = _FakeDecision(
            [
                _onto_call("query_order", {"filters": []}),
                {"content": "本体查询暂不可用。", "tool_calls": []},
            ]
        )
        monkeypatch.setattr(agent_loop, "_decision_turn", decisions)

        def boom(name: str, args: dict) -> dict:
            raise RuntimeError("tech-ont down")

        onto_tools = [
            {
                "type": "function",
                "function": {
                    "name": "query_order",
                    "description": "d",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]

        events = await _collect(
            agent_loop.run_agent_loop(
                llmgw_client=object(),
                orchestrator_client=object(),
                messages=[{"role": "user", "content": "查订单"}],
                model="m",
                roles=[],
                tenant_id="t",
                ontology_tools=onto_tools,
                ontology_tool_exec=boom,
            )
        )
        tool_results = [e for e in events if e["type"] == "tool_result"]
        assert tool_results and tool_results[0]["status"] == "error"
        assert any(e["type"] == "final" for e in events)

    @pytest.mark.asyncio
    async def test_object_cards_and_hint_enter_system_prompt(self, monkeypatch: Any) -> None:
        captured: dict[str, Any] = {}

        class _Cap:
            def __call__(self, client: Any, **kw: Any) -> Any:
                captured["history"] = list(kw.get("history") or [])

                async def gen() -> Any:
                    yield {"type": "_decision", "content": "ok", "tool_calls": []}

                return gen()

        monkeypatch.setattr(agent_loop, "_decision_turn", _Cap())
        cards = [{"individual_rid": "ont.t.ind.order.o1", "card_text": "order o1"}]
        await _collect(
            agent_loop.run_agent_loop(
                llmgw_client=object(),
                orchestrator_client=object(),
                messages=[{"role": "user", "content": "hi"}],
                model="m",
                roles=[],
                tenant_id="t",
                ontology_tools=[
                    {
                        "type": "function",
                        "function": {
                            "name": "list_classes",
                            "description": "d",
                            "parameters": {"type": "object", "properties": {}},
                        },
                    }
                ],
                ontology_tool_exec=lambda n, a: {},
                object_cards=cards,
            )
        )
        system = captured["history"][0]["content"]
        assert "本体能力" in system  # ontology_hint 生效
        assert "ont.t.ind.order.o1" in system  # OAG 卡片注入（rid 可追溯）


def _evidence_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e for e in events if e["type"] == "evidence"]


def _proposal_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e for e in events if e["type"] == "proposal"]


async def _run_once(
    monkeypatch: Any,
    *,
    tool_name: str,
    tool_result: dict[str, Any],
    args: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """跑一轮本体工具执行 + 一轮收尾，返回全部事件。"""
    decisions = _FakeDecision(
        [
            _onto_call(tool_name, args or {}),
            {"content": "done", "tool_calls": []},
        ]
    )
    monkeypatch.setattr(agent_loop, "_decision_turn", decisions)
    return await _collect(
        agent_loop.run_agent_loop(
            llmgw_client=object(),
            orchestrator_client=object(),
            messages=[{"role": "user", "content": "q"}],
            model="m",
            roles=[],
            tenant_id="t",
            ontology_tools=[
                {
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "description": "d",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
            ],
            ontology_tool_exec=lambda n, a: tool_result,
        )
    )


class TestOntologyEvidenceEvents:
    """本体工具结果 → 结构化 evidence 事件（供聊天渲染证据卡片）。"""

    @pytest.mark.asyncio
    async def test_search_objects_maps_cards_to_ontology_objects(
        self, monkeypatch: Any
    ) -> None:
        events = await _run_once(
            monkeypatch,
            tool_name="search_objects",
            args={"text": "对账单"},
            tool_result={
                "cards": [
                    {"individual_rid": "ont.t.ind.order.o1", "card_text": "order o1 摘要"},
                    {"individual_rid": "ont.t.ind.order.o2", "card_text": "order o2 摘要"},
                ]
            },
        )
        ev = _evidence_events(events)
        assert len(ev) == 1
        items = ev[0]["items"]
        assert len(items) == 2
        assert items[0]["type"] == "ONTOLOGY_OBJECT"
        assert items[0]["ref"] == "ont.t.ind.order.o1"
        assert items[0]["objectId"] == "ont.t.ind.order.o1"
        assert "order o1" in items[0]["fragment"]
        assert items[0]["evidenceId"]
        # 与触发它的工具调用可对账
        assert ev[0]["toolCallId"] == "c1"

    @pytest.mark.asyncio
    async def test_query_objects_maps_each_row(self, monkeypatch: Any) -> None:
        events = await _run_once(
            monkeypatch,
            tool_name="query_order",
            tool_result={
                "kind": "objects",
                "rows": [{"rid": "ont.t.ind.order.o1", "amount": 100}],
                "result_schema": None,
            },
        )
        items = _evidence_events(events)[0]["items"]
        assert len(items) == 1
        assert items[0]["type"] == "ONTOLOGY_OBJECT"
        assert items[0]["ref"] == "ont.t.ind.order.o1"

    @pytest.mark.asyncio
    async def test_query_aggregates_maps_to_metric(self, monkeypatch: Any) -> None:
        events = await _run_once(
            monkeypatch,
            tool_name="query_order",
            tool_result={
                "kind": "aggregates",
                "rows": [{"region": "east", "total": 4200}],
                "result_schema": None,
            },
        )
        items = _evidence_events(events)[0]["items"]
        assert len(items) == 1
        assert items[0]["type"] == "ONTOLOGY_METRIC"
        assert "4200" in items[0]["fragment"]

    @pytest.mark.asyncio
    async def test_list_classes_maps_type_level_evidence(self, monkeypatch: Any) -> None:
        events = await _run_once(
            monkeypatch,
            tool_name="list_classes",
            tool_result={
                "classes": [
                    {"rid": "ont.t.obj.order.v1", "slug": "order", "display_name": "订单"},
                ]
            },
        )
        items = _evidence_events(events)[0]["items"]
        assert items[0]["ref"] == "ont.t.obj.order.v1"
        assert items[0]["concept"] == "订单"

    @pytest.mark.asyncio
    async def test_evidence_is_capped_per_tool_call(self, monkeypatch: Any) -> None:
        """类型清单可能有几十个，全量渲染会把回答挤出屏幕——单次工具调用限流。"""
        events = await _run_once(
            monkeypatch,
            tool_name="list_classes",
            tool_result={
                "classes": [
                    {"rid": f"ont.t.obj.c{i}.v1", "slug": f"c{i}", "display_name": f"C{i}"}
                    for i in range(40)
                ]
            },
        )
        items = _evidence_events(events)[0]["items"]
        assert len(items) == 8
        # 截断的是渲染面，LLM 那侧仍拿完整 tool_result
        tool_result = next(e for e in events if e["type"] == "tool_result")
        assert len(tool_result["result"]["classes"]) == 40

    @pytest.mark.asyncio
    async def test_query_row_prefers_dunder_rid(self, monkeypatch: Any) -> None:
        """ont v2 object-query 的规范身份列是 __rid__；业务主键不是 rid，不能冒充。"""
        events = await _run_once(
            monkeypatch,
            tool_name="query_dangerous_goods",
            tool_result={
                "kind": "objects",
                "rows": [
                    {
                        "__rid__": "ont.t.ind.dg.p-1",
                        "dg-product-id": "P_1",
                        "dg-hazard-class": "Class C",
                    }
                ],
                "result_schema": None,
            },
        )
        items = _evidence_events(events)[0]["items"]
        assert items[0]["objectId"] == "ont.t.ind.dg.p-1"
        assert items[0]["ref"] == "ont.t.ind.dg.p-1"

    @pytest.mark.asyncio
    async def test_query_row_without_rid_has_no_object_id(self, monkeypatch: Any) -> None:
        """没有 rid 的行仍要出示证据，但不能给 objectId（否则前端会当实例 rid 去查）。"""
        events = await _run_once(
            monkeypatch,
            tool_name="query_order",
            tool_result={
                "kind": "objects",
                "rows": [{"order-id": "o1", "amount": 100}],
                "result_schema": None,
            },
        )
        items = _evidence_events(events)[0]["items"]
        assert len(items) == 1
        assert "objectId" not in items[0]
        assert "o1" in items[0]["fragment"]

    @pytest.mark.asyncio
    async def test_inspect_class_is_type_level_without_object_id(
        self, monkeypatch: Any
    ) -> None:
        """inspect_class 是类型级证据，objectId 会诱导前端调实例接口。"""
        events = await _run_once(
            monkeypatch,
            tool_name="inspect_class",
            args={"class_rid": "ont.t.obj.order.v1"},
            tool_result={"class_rid": "ont.t.obj.order.v1", "display_name": "订单"},
        )
        items = _evidence_events(events)[0]["items"]
        assert items[0]["ref"] == "ont.t.obj.order.v1"
        assert items[0]["concept"] == "订单"
        assert "objectId" not in items[0]

    @pytest.mark.asyncio
    async def test_tool_error_emits_no_evidence(self, monkeypatch: Any) -> None:
        """工具失败时不得编造 evidence。"""
        decisions = _FakeDecision(
            [
                _onto_call("query_order", {}),
                {"content": "查询失败", "tool_calls": []},
            ]
        )
        monkeypatch.setattr(agent_loop, "_decision_turn", decisions)

        def boom(name: str, args: dict) -> dict:
            raise RuntimeError("tech-ont down")

        events = await _collect(
            agent_loop.run_agent_loop(
                llmgw_client=object(),
                orchestrator_client=object(),
                messages=[{"role": "user", "content": "q"}],
                model="m",
                roles=[],
                tenant_id="t",
                ontology_tools=[
                    {
                        "type": "function",
                        "function": {
                            "name": "query_order",
                            "description": "d",
                            "parameters": {"type": "object", "properties": {}},
                        },
                    }
                ],
                ontology_tool_exec=boom,
            )
        )
        assert _evidence_events(events) == []


class TestOntologyProposalEvents:
    """propose_* → proposal 事件（供聊天渲染 action 计划卡片 + HITL 三按钮）。"""

    @pytest.mark.asyncio
    async def test_propose_action_emits_proposal(self, monkeypatch: Any) -> None:
        events = await _run_once(
            monkeypatch,
            tool_name="propose_action",
            tool_result={
                "proposal_id": "prop-1",
                "status": "pending",
                "impact_summary": "将订单 o1 状态改为已确认",
                "note": "等待用户确认",
            },
        )
        ev = _proposal_events(events)
        assert len(ev) == 1
        assert ev[0]["proposalId"] == "prop-1"
        assert ev[0]["kind"] == "action"
        assert ev[0]["status"] == "pending"
        assert "已确认" in ev[0]["impactSummary"]
        assert ev[0]["toolCallId"] == "c1"

    @pytest.mark.asyncio
    async def test_propose_create_instance_kind(self, monkeypatch: Any) -> None:
        events = await _run_once(
            monkeypatch,
            tool_name="propose_create_instance",
            tool_result={
                "proposal_id": "prop-2",
                "kind": "create_instance",
                "status": "pending",
                "impact_summary": "新建客户 C-100",
            },
        )
        ev = _proposal_events(events)[0]
        assert ev["proposalId"] == "prop-2"
        assert ev["kind"] == "create_instance"

    @pytest.mark.asyncio
    async def test_non_proposal_tool_emits_no_proposal_event(
        self, monkeypatch: Any
    ) -> None:
        events = await _run_once(
            monkeypatch,
            tool_name="list_classes",
            tool_result={"classes": []},
        )
        assert _proposal_events(events) == []
