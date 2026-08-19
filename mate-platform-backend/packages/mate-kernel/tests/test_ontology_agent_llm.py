"""LLM-backed OntologyAgent.handle_message() 路由测试。"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import pytest

from mate_kernel.agent.ontology import (
    ACTION_KINDS,
    LlmClientLike,
    LlmDispatcher,
    LlmDispatchResult,
    OntologyAgent,
    _extract_first_json,
    _normalize_action,
    _propose_object_type_payload,
)


# ─────────────────── Fakes ───────────────────


@dataclass
class FakeLlm:
    """LLM client stub —— 按 prompt 顺序返回值，或单值覆盖。"""
    responses: list[str] = field(default_factory=list)
    calls: list[tuple[str, str]] = field(default_factory=list)
    fail_on_next: bool = False

    async def chat(self, system: str, user: str, **kwargs: Any) -> str:
        self.calls.append((system, user))
        if self.fail_on_next:
            self.fail_on_next = False
            raise RuntimeError("llm network boom")
        if not self.responses:
            raise AssertionError("FakeLlm out of responses")
        return self.responses.pop(0)


@dataclass
class FakeDispatcher:
    """tech-ont dispatcher stub —— 全部入参透传 + 返回值。"""
    list_calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    inspect_calls: list[tuple[str, str]] = field(default_factory=list)
    search_calls: list[tuple[str, str, str | None, int]] = field(default_factory=list)
    propose_type_calls: list[tuple[str, dict[str, Any], str]] = field(default_factory=list)
    propose_instance_calls: list[tuple[str, str, dict[str, Any], str]] = field(default_factory=list)
    propose_merge_calls: list[tuple[str, str, str, float, str, dict[str, str]]] = field(default_factory=list)

    next_type_pid: str = "pid-type-1"
    next_instance_pid: str = "pid-inst-1"
    next_merge_pid: str = "pid-merge-1"
    list_payload: list[dict[str, Any]] = field(default_factory=lambda: [{"rid": "ont.acme.obj.order.v1"}])
    inspect_payload: dict[str, Any] = field(default_factory=lambda: {"rid": "ont.acme.obj.order.v1", "props": []})
    search_payload: list[dict[str, Any]] = field(default_factory=list)

    async def list_object_types(self, tenant_id: str, **kwargs: Any) -> list[dict[str, Any]]:
        self.list_calls.append((tenant_id, kwargs))
        return list(self.list_payload)

    async def inspect_class(
        self, tenant_id: str, class_rid: str, **kwargs: Any,
    ) -> dict[str, Any]:
        self.inspect_calls.append((tenant_id, class_rid))
        return dict(self.inspect_payload)

    async def search_objects(
        self,
        tenant_id: str,
        text: str,
        class_rid: str | None,
        top_k: int,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        self.search_calls.append((tenant_id, text, class_rid, top_k))
        return list(self.search_payload)

    async def propose_object_type(
        self,
        tenant_id: str,
        type_def: dict[str, Any],
        impact_summary: str,
        **kwargs: Any,
    ) -> str:
        self.propose_type_calls.append((tenant_id, type_def, impact_summary))
        return self.next_type_pid

    async def propose_instance(
        self,
        tenant_id: str,
        class_rid: str,
        props: dict[str, Any],
        impact_summary: str,
        **kwargs: Any,
    ) -> str:
        self.propose_instance_calls.append((tenant_id, class_rid, props, impact_summary))
        return self.next_instance_pid

    async def propose_merge(
        self,
        tenant_id: str,
        source_rid: str,
        target_rid: str,
        similarity: float,
        impact_summary: str,
        mapping: dict[str, str],
        **kwargs: Any,
    ) -> str:
        self.propose_merge_calls.append(
            (tenant_id, source_rid, target_rid, similarity, impact_summary, mapping),
        )
        return self.next_merge_pid


# ─────────────────── protocol conformance ───────────────────


def test_llm_client_protocol_conformance() -> None:
    """FakeLsm 应满足 LlmClientLike Protocol（runtime_checkable）。"""
    assert isinstance(FakeLlm(), LlmClientLike)


def test_dispatcher_protocol_conformance() -> None:
    """FakeDispatcher 应满足 LlmDispatcher Protocol。"""
    assert isinstance(FakeDispatcher(), LlmDispatcher)


# ─────────────────── helpers / JSON schema ───────────────────


def test_extract_first_json_plain() -> None:
    obj = _extract_first_json('{"a": 1, "b": "x"}')
    assert obj == {"a": 1, "b": "x"}


def test_extract_first_json_with_fence() -> None:
    obj = _extract_first_json('Here it is:\n```json\n{"a": 1}\n```\nDone.')
    assert obj == {"a": 1}


def test_extract_first_json_in_prose() -> None:
    obj = _extract_first_json('Sure, {"action": "list", "parameters": {}} is the answer.')
    assert obj == {"action": "list", "parameters": {}}


def test_extract_first_json_invalid_returns_none() -> None:
    assert _extract_first_json("not json at all") is None
    assert _extract_first_json("") is None


def test_normalize_action_known_and_unknown() -> None:
    a, p, r = _normalize_action({"action": "list", "parameters": {}, "reason": "ok"})
    assert a == "list" and p == {} and r == "ok"
    with pytest.raises(ValueError):
        _normalize_action({"action": "delete_all", "parameters": {}, "reason": ""})
    with pytest.raises(ValueError):
        _normalize_action({"parameters": {}, "reason": ""})


def test_normalize_action_parameters_not_dict() -> None:
    with pytest.raises(ValueError):
        _normalize_action({"action": "list", "parameters": "no", "reason": ""})


def test_propose_object_type_payload_derives_rid_and_pk() -> None:
    type_def, impact = _propose_object_type_payload("acme", {
        "name": "Order", "slug": "order",
        "primary_key": "order_id",
        "properties": [
            {"name": "order_id", "type_id": "string", "primary_key": True},
            {"name": "amount", "type_id": "float"},
            {"name": "status", "type_id": "string", "nullable": True},
        ],
    })
    assert type_def["rid"] == "ont.acme.obj.order.v1"
    assert type_def["display_name"] == "Order"
    pk = type_def["primary_key"]
    assert len(pk) == 1
    assert type_def["properties"][0]["rid"] == pk[0]
    assert any(p["primary_key"] for p in type_def["properties"])
    assert "将创建 ObjectType" in impact


def test_propose_object_type_payload_pk_inferred_when_missing() -> None:
    type_def, _ = _propose_object_type_payload("acme", {
        "slug": "customer", "properties": [{"name": "name", "type_id": "string"}],
        "primary_key": "id",
    })
    pks = [p for p in type_def["properties"] if p["primary_key"]]
    assert len(pks) == 1
    assert pks[0]["title"] == "id"


# ─────────────────── LLM-backed handle_message 路由 ───────────────────


def _agent(llm: FakeLlm, disp: FakeDispatcher) -> OntologyAgent:
    return OntologyAgent(llm=llm, dispatcher=disp)


@pytest.mark.asyncio
async def test_handle_message_routes_to_list() -> None:
    disp = FakeDispatcher()
    llm = FakeLlm(responses=[json.dumps({
        "action": "list", "parameters": {}, "reason": "show all",
    })])
    agent = _agent(llm, disp)
    result = await agent.handle_message("列出所有 ObjectType", {"tenant_id": "acme"})
    assert isinstance(result, LlmDispatchResult)
    assert result.action == "list"
    assert result.error is None
    assert disp.list_calls and disp.list_calls[0][0] == "acme"
    assert result.extra.get("items") == disp.list_payload


@pytest.mark.asyncio
async def test_handle_message_routes_to_inspect() -> None:
    disp = FakeDispatcher()
    llm = FakeLlm(responses=[json.dumps({
        "action": "inspect",
        "parameters": {"rid": "ont.acme.obj.order.v1"},
        "reason": "show order",
    })])
    agent = _agent(llm, disp)
    result = await agent.handle_message("查看订单", {"tenant_id": "acme"})
    assert result.action == "inspect"
    assert disp.inspect_calls == [("acme", "ont.acme.obj.order.v1")]
    assert result.extra == disp.inspect_payload


@pytest.mark.asyncio
async def test_handle_message_routes_to_propose_object_type() -> None:
    disp = FakeDispatcher(next_type_pid="pid-ot-42")
    llm = FakeLlm(responses=[json.dumps({
        "action": "propose_object_type",
        "parameters": {
            "name": "Order",
            "slug": "order",
            "primary_key": "order_id",
            "properties": [
                {"name": "order_id", "type_id": "string", "primary_key": True},
                {"name": "amount", "type_id": "float"},
            ],
        },
        "reason": "建新类型",
    })])
    agent = _agent(llm, disp)
    result = await agent.handle_message(
        "帮我建一个 Order", {"tenant_id": "acme"},
    )
    assert result.action == "propose_object_type"
    assert result.proposal_id == "pid-ot-42"
    assert result.error is None
    assert disp.propose_type_calls, "dispatcher 必被调用"
    _tenant, type_def, impact = disp.propose_type_calls[0]
    assert _tenant == "acme"
    assert type_def["rid"] == "ont.acme.obj.order.v1"
    assert any(p["primary_key"] for p in type_def["properties"])
    assert "将创建 ObjectType" in impact


@pytest.mark.asyncio
async def test_handle_message_routes_to_propose_instance() -> None:
    disp = FakeDispatcher(next_instance_pid="pid-inst-7")
    llm = FakeLlm(responses=[json.dumps({
        "action": "propose_instance",
        "parameters": {
            "class_rid": "ont.acme.obj.order.v1",
            "props": {
                "ont.acme.prop.order-order-id.v1": "ord-99",
                "amount": 200,
            },
        },
        "reason": "build",
    })])
    agent = _agent(llm, disp)
    result = await agent.handle_message(
        "build order",
        {"tenant_id": "acme"},
    )
    assert result.action == "propose_instance"
    assert result.proposal_id == "pid-inst-7"
    _t, class_rid, props, impact = disp.propose_instance_calls[0]
    assert class_rid == "ont.acme.obj.order.v1"
    assert props["amount"] == 200
    # impact 含 class_rid 与 properties count（ASCII-safe 断言）
    assert class_rid in impact
    assert "2" in impact  # 2 个属性


@pytest.mark.asyncio
async def test_handle_message_routes_to_merge_suggestion() -> None:
    disp = FakeDispatcher(next_merge_pid="pid-merge-3")
    llm = FakeLlm(responses=[json.dumps({
        "action": "merge_suggestion",
        "parameters": {
            "source_rid": "ont.acme.obj.sales-order.v1",
            "target_rid": "ont.acme.obj.order.v1",
            "similarity": 0.92,
            "mapping": {
                "ont.acme.prop.sales-order-amount.v1": "ont.acme.prop.order-amount.v1",
            },
        },
        "reason": "这两个本质相同",
    })])
    agent = _agent(llm, disp)
    result = await agent.handle_message(
        "把 sales-order 合并到 order",
        {"tenant_id": "acme"},
    )
    assert result.action == "merge_suggestion"
    assert result.proposal_id == "pid-merge-3"
    call = disp.propose_merge_calls[0]
    _t, src, tgt, sim, impact, mapping = call
    assert src == "ont.acme.obj.sales-order.v1"
    assert tgt == "ont.acme.obj.order.v1"
    assert abs(sim - 0.92) < 1e-9
    assert mapping["ont.acme.prop.sales-order-amount.v1"] == "ont.acme.prop.order-amount.v1"
    assert "similarity=0.92" in impact


@pytest.mark.asyncio
async def test_handle_message_routes_to_search() -> None:
    disp = FakeDispatcher(search_payload=[{"rid": "ont.acme.obj.order.v1", "score": 0.7}])
    llm = FakeLlm(responses=[json.dumps({
        "action": "search",
        "parameters": {"text": "订单", "top_k": 3},
        "reason": "找订单类型",
    })])
    agent = _agent(llm, disp)
    result = await agent.handle_message("搜索订单", {"tenant_id": "acme"})
    assert result.action == "search"
    assert result.candidates == disp.search_payload
    assert disp.search_calls == [("acme", "订单", None, 3)]


@pytest.mark.asyncio
async def test_handle_message_accepts_markdown_fenced_json() -> None:
    disp = FakeDispatcher()
    llm = FakeLlm(responses=[
        "OK here\n```json\n" + json.dumps({
            "action": "list", "parameters": {}, "reason": "",
        }) + "\n```\n",
    ])
    agent = _agent(llm, disp)
    result = await agent.handle_message("list", {"tenant_id": "acme"})
    assert result.action == "list"
    assert result.error is None


@pytest.mark.asyncio
async def test_handle_message_accepts_prose_wrapped_json() -> None:
    disp = FakeDispatcher()
    payload = json.dumps({"action": "list", "parameters": {}, "reason": "ok"})
    llm = FakeLlm(responses=[f"Sure: {payload}. That's it."])
    agent = _agent(llm, disp)
    result = await agent.handle_message("list", {"tenant_id": "acme"})
    assert result.action == "list"


@pytest.mark.asyncio
async def test_handle_message_no_dispatcher_only_parses() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "propose_object_type",
        "parameters": {"slug": "order", "primary_key": "id",
                       "properties": [{"name": "id", "type_id": "string"}]},
        "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=None)
    result = await agent.handle_message("建 order", {"tenant_id": "acme"})
    assert result.action == "propose_object_type"
    assert result.proposal_id is None  # 没 dispatcher —— 不调
    assert result.error is None


@pytest.mark.asyncio
async def test_handle_message_no_llm_returns_error() -> None:
    agent = OntologyAgent(llm=None, dispatcher=FakeDispatcher())
    result = await agent.handle_message("anything", {"tenant_id": "acme"})
    assert result.action == "error"
    assert result.error == "llm_not_configured"


@pytest.mark.asyncio
async def test_handle_message_empty_returns_error() -> None:
    agent = OntologyAgent(llm=FakeLlm(responses=["unused"]), dispatcher=FakeDispatcher())
    result = await agent.handle_message("   ", {"tenant_id": "acme"})
    assert result.action == "error"
    assert result.error == "empty_message"
    # LLM 一定不能被调
    assert agent._llm  # type: ignore[union-attr]
    assert not agent._llm.calls  # type: ignore[union-attr]


# ─────────────────── action_kind 枚举覆盖 ───────────────────


def test_action_kinds_complete() -> None:
    """ACTION_KINDS 与 prompt 文档保持同步。"""
    expected = {"list", "inspect", "propose_object_type", "propose_instance",
                "merge_suggestion", "search"}
    assert set(ACTION_KINDS) == expected
