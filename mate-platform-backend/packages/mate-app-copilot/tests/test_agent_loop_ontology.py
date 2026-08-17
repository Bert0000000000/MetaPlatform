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
        "tool_calls": [{
            "id": call_id, "type": "function",
            "function": {"name": name, "arguments": _json.dumps(args, ensure_ascii=False)},
        }],
    }


async def _collect(agraph: Any) -> list[dict[str, Any]]:
    return [ev async for ev in agraph]


class TestOntologyToolExecution:
    @pytest.mark.asyncio
    async def test_query_answered_without_dispatch(self, monkeypatch: Any) -> None:
        decisions = _FakeDecision([
            _onto_call("list_classes", {}),
            {"content": "系统里有 2 个本体类型：order 和 ledger。", "tool_calls": []},
        ])
        monkeypatch.setattr(agent_loop, "_decision_turn", decisions)

        executed: list[tuple[str, dict]] = []

        def exec_fn(name: str, args: dict) -> dict:
            executed.append((name, args))
            return {"classes": [{"rid": "ont.t.obj.order.v1"}, {"rid": "ont.t.obj.ledger.v1"}]}

        onto_tools = [
            {"type": "function", "function": {
                "name": "list_classes", "description": "d",
                "parameters": {"type": "object", "properties": {}},
            }},
        ]

        events = await _collect(agent_loop.run_agent_loop(
            llmgw_client=object(),
            orchestrator_client=object(),
            messages=[{"role": "user", "content": "系统里有多少本体"}],
            model="m",
            roles=[{"role": "workflow", "name": "W", "capabilities": []}],
            tenant_id="t",
            ontology_tools=onto_tools,
            ontology_tool_exec=exec_fn,
        ))

        assert executed == [("list_classes", {})]
        kinds = [(e["type"], e.get("tool")) for e in events]
        assert ("tool_call", "list_classes") in kinds
        assert ("tool_result", None) != kinds[0]
        tool_results = [e for e in events if e["type"] == "tool_result"]
        assert tool_results and tool_results[0]["status"] == "success"
        assert len(tool_results[0]["result"]["classes"]) == 2
        final = [e for e in events if e["type"] == "final"]
        assert final and "2 个本体" in final[0]["content"]
        # 未触发任何 dispatch（没有 dispatch_employee 工具调用事件）
        assert not any(e.get("tool") == "dispatch_employee" for e in events)

    @pytest.mark.asyncio
    async def test_tool_error_degrades_not_crashes(self, monkeypatch: Any) -> None:
        decisions = _FakeDecision([
            _onto_call("query_order", {"filters": []}),
            {"content": "本体查询暂不可用。", "tool_calls": []},
        ])
        monkeypatch.setattr(agent_loop, "_decision_turn", decisions)

        def boom(name: str, args: dict) -> dict:
            raise RuntimeError("tech-ont down")

        onto_tools = [{"type": "function", "function": {
            "name": "query_order", "description": "d",
            "parameters": {"type": "object", "properties": {}},
        }}]

        events = await _collect(agent_loop.run_agent_loop(
            llmgw_client=object(),
            orchestrator_client=object(),
            messages=[{"role": "user", "content": "查订单"}],
            model="m",
            roles=[],
            tenant_id="t",
            ontology_tools=onto_tools,
            ontology_tool_exec=boom,
        ))
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
        await _collect(agent_loop.run_agent_loop(
            llmgw_client=object(),
            orchestrator_client=object(),
            messages=[{"role": "user", "content": "hi"}],
            model="m",
            roles=[],
            tenant_id="t",
            ontology_tools=[{"type": "function", "function": {
                "name": "list_classes", "description": "d",
                "parameters": {"type": "object", "properties": {}},
            }}],
            ontology_tool_exec=lambda n, a: {},
            object_cards=cards,
        ))
        system = captured["history"][0]["content"]
        assert "本体能力" in system  # ontology_hint 生效
        assert "ont.t.ind.order.o1" in system  # OAG 卡片注入（rid 可追溯）
