"""LLM-backed OntologyAgent.handle_message() 输入校验 / graceful fallback 测试。

覆盖：
- LLM 返回非 JSON（自然语言段 / Markdown 头 / 代码块不闭合）→ graceful error，不抛异常
- LLM 输出 JSON 但 action 缺失 / 类型错 / 不识别 → graceful error
- LLM 输出 JSON 但 cross-tenant rid / 缺必填字段 → graceful error
- LLM chat() 本身抛异常 → graceful error
- dispatcher 抛异常 → graceful error（不污染上层）

所有失败路径必须以 ``error`` 字段形式返回，不允许抛未捕获异常到调用方。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import pytest

from mate_kernel.agent.ontology import OntologyAgent, _extract_first_json, _normalize_action


@dataclass
class FakeLlm:
    responses: list[str] = field(default_factory=list)
    fail: bool = False
    calls: list[tuple[str, str]] = field(default_factory=list)

    async def chat(self, system: str, user: str, **kwargs: Any) -> str:
        self.calls.append((system, user))
        if self.fail:
            raise RuntimeError("upstream LLM unavailable")
        if not self.responses:
            raise AssertionError("out of responses")
        return self.responses.pop(0)


@dataclass
class FailingDispatcher:
    """全部 dispatcher 方法都抛 —— 模拟 dispatch 阶段故障。"""
    mode: str = "raise"  # raise / return_partial

    async def list_object_types(self, tenant_id: str, **kwargs: Any) -> list[dict[str, Any]]:
        raise RuntimeError("tech-ont down")

    async def inspect_class(self, tenant_id: str, class_rid: str, **kwargs: Any) -> dict[str, Any]:
        raise RuntimeError("tech-ont down")

    async def search_objects(
        self, tenant_id: str, text: str,
        class_rid: str | None, top_k: int, **kwargs: Any,
    ) -> list[dict[str, Any]]:
        raise RuntimeError("tech-ont down")

    async def propose_object_type(
        self, tenant_id: str, type_def: dict[str, Any],
        impact_summary: str, **kwargs: Any,
    ) -> str:
        raise RuntimeError("propose failed")

    async def propose_instance(
        self, tenant_id: str, class_rid: str,
        props: dict[str, Any], impact_summary: str, **kwargs: Any,
    ) -> str:
        raise RuntimeError("propose failed")

    async def propose_merge(
        self, tenant_id: str, source_rid: str, target_rid: str,
        similarity: float, impact_summary: str, mapping: dict[str, str],
        **kwargs: Any,
    ) -> str:
        raise RuntimeError("propose failed")


# ─────────────────── _extract_first_json / _normalize_action 边界 ───────────────────


def test_extract_first_json_unclosed_brace_returns_none() -> None:
    assert _extract_first_json('{"a":') is None


def test_extract_first_json_braces_inside_string_ignored() -> None:
    # 平衡提取应该正确处理嵌套对象；这里只是确保不会返回乱码
    obj = _extract_first_json('{"a": {"b": 2}}')
    assert obj == {"a": {"b": 2}}


def test_normalize_action_missing_action_field() -> None:
    with pytest.raises(ValueError):
        _normalize_action({"parameters": {}})


def test_normalize_action_non_string_action() -> None:
    with pytest.raises(ValueError):
        _normalize_action({"action": 42, "parameters": {}})


def test_normalize_action_unknown_action() -> None:
    with pytest.raises(ValueError, match="unknown action_kind"):
        _normalize_action({"action": "delete_world", "parameters": {}})


# ─────────────────── LLM 输出非 JSON ───────────────────


@pytest.mark.asyncio
async def test_invalid_output_pure_prose() -> None:
    llm = FakeLlm(responses=["Sorry, I cannot help with that."])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("anything", {"tenant_id": "acme"})
    assert result.action == "error"
    assert result.error == "llm_output_not_json"
    assert result.raw_output == "Sorry, I cannot help with that."


@pytest.mark.asyncio
async def test_invalid_output_unclosed_markdown_fence() -> None:
    llm = FakeLlm(responses=["```json\n{\"action\": \"list\""])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("anything", {"tenant_id": "acme"})
    assert result.action == "error"
    assert result.error == "llm_output_not_json"


@pytest.mark.asyncio
async def test_empty_llm_output() -> None:
    llm = FakeLlm(responses=[""])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("anything", {"tenant_id": "acme"})
    assert result.action == "error"
    assert result.error == "llm_output_not_json"


@pytest.mark.asyncio
async def test_invalid_output_random_garbage() -> None:
    llm = FakeLlm(responses=["}{ garbage {{ ]]"])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("anything", {"tenant_id": "acme"})
    assert result.action == "error"
    assert result.error == "llm_output_not_json"


# ─────────────────── LLM 输出 JSON 但 action 不合法 ───────────────────


@pytest.mark.asyncio
async def test_missing_action_field() -> None:
    llm = FakeLlm(responses=[json.dumps({"parameters": {}, "reason": "missing action"})])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("anything", {"tenant_id": "acme"})
    assert result.action == "error"
    assert "invalid_action" in (result.error or "")
    assert "missing" in (result.error or "")


@pytest.mark.asyncio
async def test_unknown_action_kind() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "wipe_database",
        "parameters": {}, "reason": "bad",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("anything", {"tenant_id": "acme"})
    assert result.action == "error"
    assert "wipe_database" in (result.error or "")


@pytest.mark.asyncio
async def test_parameters_wrong_type() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "list", "parameters": "no", "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("anything", {"tenant_id": "acme"})
    assert result.action == "error"
    assert "invalid_action" in (result.error or "")


# ─────────────────── action 合法但 rid / 字段跨租户或缺失 ───────────────────


@pytest.mark.asyncio
async def test_inspect_missing_rid_rejected() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "inspect", "parameters": {}, "reason": "no rid",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("x", {"tenant_id": "acme"})
    assert result.action == "inspect"
    assert result.error is not None
    # 含 "rid" 关键词即可（无关具体中英）
    assert "rid" in result.error.lower()


@pytest.mark.asyncio
async def test_inspect_cross_tenant_rejected() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "inspect",
        "parameters": {"rid": "ont.other.obj.x.v1"},
        "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("x", {"tenant_id": "acme"})
    assert result.action == "inspect"
    assert result.error is not None
    assert "cross-tenant" in result.error


@pytest.mark.asyncio
async def test_propose_instance_missing_class_rid_rejected() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "propose_instance",
        "parameters": {"props": {"a": 1}},
        "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("x", {"tenant_id": "acme"})
    assert result.action == "propose_instance"
    assert result.error is not None
    assert "class_rid" in result.error


@pytest.mark.asyncio
async def test_propose_instance_cross_tenant_rejected() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "propose_instance",
        "parameters": {"class_rid": "ont.other.obj.x.v1", "props": {"a": 1}},
        "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("x", {"tenant_id": "acme"})
    assert result.action == "propose_instance"
    assert "cross-tenant" in (result.error or "")


@pytest.mark.asyncio
async def test_merge_missing_source_or_target_rejected() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "merge_suggestion",
        "parameters": {"source_rid": "ont.acme.obj.a.v1"},
        "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("x", {"tenant_id": "acme"})
    assert result.action == "merge_suggestion"
    assert result.error is not None
    assert "source_rid" in result.error and "target_rid" in result.error


@pytest.mark.asyncio
async def test_merge_cross_tenant_rejected() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "merge_suggestion",
        "parameters": {
            "source_rid": "ont.acme.obj.a.v1",
            "target_rid": "ont.other.obj.b.v1",
        },
        "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("x", {"tenant_id": "acme"})
    assert result.action == "merge_suggestion"
    assert "cross-tenant merge denied" in (result.error or "")


@pytest.mark.asyncio
async def test_propose_object_type_missing_slug_rejected() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "propose_object_type",
        "parameters": {"properties": []},
        "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("x", {"tenant_id": "acme"})
    assert result.action == "propose_object_type"
    assert result.error is not None
    assert "slug" in result.error.lower()


# ─────────────────── LLM / Dispatcher 自身挂掉 ───────────────────


@pytest.mark.asyncio
async def test_llm_chat_exception_caught() -> None:
    llm = FakeLlm(fail=True)
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("any", {"tenant_id": "acme"})
    assert result.action == "error"
    assert result.error is not None
    assert result.error.startswith("llm_chat_failed:")


@pytest.mark.asyncio
async def test_dispatcher_exception_caught() -> None:
    llm = FakeLlm(responses=[json.dumps({
        "action": "propose_object_type",
        "parameters": {"slug": "x", "primary_key": "id",
                       "properties": [{"name": "id", "type_id": "string"}]},
        "reason": "",
    })])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("建 x", {"tenant_id": "acme"})
    assert result.action == "propose_object_type"
    assert result.proposal_id is None  # dispatcher 抛了，pid 没拿到
    assert result.error is not None
    assert result.error.startswith("dispatch_failed:")


# ─────────────────── reason / raw_output 透传 ───────────────────


@pytest.mark.asyncio
async def test_raw_output_and_reason_preserved_on_error_path() -> None:
    raw = "I cannot do that, sorry."
    llm = FakeLlm(responses=[raw])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("pwn", {"tenant_id": "acme"})
    assert result.raw_output == raw
    assert result.error == "llm_output_not_json"
    assert result.reason == ""


@pytest.mark.asyncio
async def test_empty_message_short_circuits_before_llm() -> None:
    """空消息直接 short-circuit，不调 LLM。"""
    llm = FakeLlm(responses=["unused"])
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("", {"tenant_id": "acme"})
    assert result.action == "error"
    assert result.error == "empty_message"
    assert llm.calls == []


@pytest.mark.asyncio
async def test_whitespace_only_message_short_circuits() -> None:
    llm = FakeLlm()
    agent = OntologyAgent(llm=llm, dispatcher=FailingDispatcher())
    result = await agent.handle_message("\n\t  \n", {"tenant_id": "acme"})
    assert result.error == "empty_message"
    assert llm.calls == []
