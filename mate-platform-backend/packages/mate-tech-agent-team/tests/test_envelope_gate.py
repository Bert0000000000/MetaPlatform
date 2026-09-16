"""1.4 任务 1 · 包络四维在**执行侧**真的拦人（ADR-0066 §3.3）。

1.3 的状态：四维在「员工定义 + 派活判定」两侧贯通了，但**执行侧只有 ``tools``
真的拦人**——``action_rids`` / ``kb_ids`` / ``markings`` 判定完就没人再看一眼，
员工照旧能调包络外的 Action、检索包络外的知识库、吃进包络外的标记数据。

本文件的判据（逐维 negative）：

| 维度 | 负例 |
| --- | --- |
| ``tools`` | 已在 ``test_employee_runtime.py`` 覆盖，这里只做回归 |
| ``action_rids`` | 点名包络外 ActionType → 拒，且**不落网** |
| ``kb_ids`` | 点名包络外知识库 → 拒；不点名 → 收窄到包络内 |
| ``markings`` | 带标记数据超出包络 marking 集合 → 拒（复用既有合取门） |

「只收窄放行」是每维的另一半：子集与相等放行，超集拒绝。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team.authority import Envelope
from mate_tech_agent_team.envelope_gate import EnvelopeGate
from mate_tech_agent_team.toolbox import ToolNotAllowed

#: 发起用户（链根）实际发放到这次运行的包络。
ENVELOPE = Envelope(
    tools=frozenset(
        {
            "ont_object_query",
            "ont_inspect_class",
            "ont_merge_objects",
            "ont_propose_action",
            "ont_batch_actions",
            "ont_propose_model_type",
            "kb_search",
        }
    ),
    action_rids=frozenset({"ont.acme.action.approve-order.v1"}),
    kb_ids=frozenset({"kb-orders", "kb-handbook"}),
    markings=frozenset({"internal"}),
)


class RecordingToolbox:
    """工具面替身：记录真的被派发到后端的调用。"""

    def __init__(
        self,
        *,
        descriptors: list[dict[str, Any]] | None = None,
        result: Any = None,
    ) -> None:
        self._descriptors = descriptors or []
        self._result = result if result is not None else {"ok": True}
        self.invoked: list[tuple[str, dict[str, Any]]] = []

    async def descriptors(self, *, allowed):
        return [d for d in self._descriptors if d["name"] in allowed]

    async def schemas(self, *, allowed):
        return []

    async def invoke(self, *, name: str, arguments: dict[str, Any], allowed):
        self.invoked.append((name, arguments))
        return self._result


def _gate(toolbox: RecordingToolbox, envelope: Envelope = ENVELOPE) -> EnvelopeGate:
    return EnvelopeGate(toolbox=toolbox, envelope=envelope)


# ── tools：回归（1.0/1.1 已拦，别被这次改动弄丢）────────────────────────


@pytest.mark.asyncio
async def test_tool_outside_the_envelope_is_still_rejected() -> None:
    toolbox = RecordingToolbox()
    with pytest.raises(ToolNotAllowed) as excinfo:
        await _gate(toolbox).invoke(name="ont_delete_everything", arguments={}, allowed=("x",))
    assert excinfo.value.reason == "authority_envelope:tools"
    assert toolbox.invoked == []


# ── action_rids：点名包络外的 ActionType 必须拒 ──────────────────────────


@pytest.mark.asyncio
async def test_action_rid_inside_the_envelope_is_dispatched() -> None:
    toolbox = RecordingToolbox()
    result = await _gate(toolbox).invoke(
        name="ont_propose_action",
        arguments={"action_rid": "ont.acme.action.approve-order.v1", "parameters": {}},
        allowed=("ont_propose_action",),
    )
    assert result == {"ok": True}
    assert len(toolbox.invoked) == 1


@pytest.mark.asyncio
async def test_action_rid_outside_the_envelope_is_rejected_and_never_dispatched() -> None:
    toolbox = RecordingToolbox()
    with pytest.raises(ToolNotAllowed) as excinfo:
        await _gate(toolbox).invoke(
            name="ont_propose_action",
            arguments={"action_rid": "ont.acme.action.delete-tenant.v1"},
            allowed=("ont_propose_action",),
        )
    assert excinfo.value.reason == "authority_envelope:action_rids"
    assert toolbox.invoked == [], "包络外的 Action 竟然打到了后端"


@pytest.mark.asyncio
async def test_action_rid_list_outside_the_envelope_is_rejected() -> None:
    """``action_rids`` 复数形态（批量提议）走同一条判定。"""
    toolbox = RecordingToolbox()
    with pytest.raises(ToolNotAllowed) as excinfo:
        await _gate(toolbox).invoke(
            name="ont_batch_actions",
            arguments={"action_rids": ["ont.acme.action.approve-order.v1", "ont.acme.action.wipe.v1"]},
            allowed=("ont_batch_actions",),
        )
    assert excinfo.value.reason == "authority_envelope:action_rids"
    assert toolbox.invoked == []


@pytest.mark.asyncio
async def test_empty_action_envelope_blocks_every_action() -> None:
    """空包络 = 一个 Action 都碰不了（fail-closed）。"""
    toolbox = RecordingToolbox()
    with pytest.raises(ToolNotAllowed):
        await _gate(toolbox, Envelope(tools=frozenset({"ont_propose_action"}))).invoke(
            name="ont_propose_action",
            arguments={"action_rid": "ont.acme.action.approve-order.v1"},
            allowed=("ont_propose_action",),
        )
    assert toolbox.invoked == []


# ── kb_ids：检索限定在包络内的知识库 ─────────────────────────────────────


@pytest.mark.asyncio
async def test_kb_subset_is_dispatched() -> None:
    toolbox = RecordingToolbox()
    await _gate(toolbox).invoke(
        name="kb_search",
        arguments={"query": "退货政策", "kb_ids": ["kb-orders"]},
        allowed=("kb_search",),
    )
    assert toolbox.invoked == [("kb_search", {"query": "退货政策", "kb_ids": ["kb-orders"]})]


@pytest.mark.asyncio
async def test_kb_outside_the_envelope_is_rejected_and_never_dispatched() -> None:
    toolbox = RecordingToolbox()
    with pytest.raises(ToolNotAllowed) as excinfo:
        await _gate(toolbox).invoke(
            name="kb_search",
            arguments={"query": "工资表", "kb_ids": ["kb-salaries"]},
            allowed=("kb_search",),
        )
    assert excinfo.value.reason == "authority_envelope:kb_ids"
    assert toolbox.invoked == []


@pytest.mark.asyncio
async def test_mixed_kb_ids_are_rejected_not_silently_trimmed() -> None:
    """一半在内一半在外 → 整次拒绝。

    静默裁剪会让"我要 kb-salaries"变成"我拿到了 kb-orders 的结果"，
    调用方无从发现有东西被吃掉了。
    """
    toolbox = RecordingToolbox()
    with pytest.raises(ToolNotAllowed):
        await _gate(toolbox).invoke(
            name="kb_search",
            arguments={"query": "混合", "kb_ids": ["kb-orders", "kb-salaries"]},
            allowed=("kb_search",),
        )
    assert toolbox.invoked == []


@pytest.mark.asyncio
async def test_kb_search_without_scope_is_narrowed_to_the_envelope() -> None:
    """不点名知识库时，检索面收窄到包络内的那些——这是**收窄**，不是放行。"""
    toolbox = RecordingToolbox()
    await _gate(toolbox).invoke(
        name="kb_search", arguments={"query": "订单"}, allowed=("kb_search",)
    )
    name, arguments = toolbox.invoked[0]
    assert name == "kb_search"
    assert sorted(arguments["kb_ids"]) == ["kb-handbook", "kb-orders"]
    assert arguments["query"] == "订单"


@pytest.mark.asyncio
async def test_kb_search_without_scope_and_without_granted_kbs_passes_through() -> None:
    """包络没有知识库维度时**不注入空列表**。

    空列表在 MCP 面等于"限定到零个库"，会把一次正常检索变成永远无命中——
    那是一种看起来像跑通了的假回执。这一维没被收窄时不越权改写参数。
    """
    toolbox = RecordingToolbox()
    envelope = Envelope(tools=frozenset({"kb_search"}))
    await _gate(toolbox, envelope).invoke(
        name="kb_search", arguments={"query": "订单"}, allowed=("kb_search",)
    )
    assert toolbox.invoked == [("kb_search", {"query": "订单"})]


# ── markings：带标记数据不得超过包络的 marking 集合 ──────────────────────
# 复用既有合取门（``mate_kernel.tooling.schema_gen.markings_satisfied``：
# ``set(item.marking) <= held``），不另造一套。


@pytest.mark.asyncio
async def test_result_within_the_marking_set_passes() -> None:
    toolbox = RecordingToolbox(result={"items": [{"rid": "a", "marking": ["internal"]}]})
    result = await _gate(toolbox).invoke(
        name="ont_object_query", arguments={}, allowed=("ont_object_query",)
    )
    assert result["items"][0]["rid"] == "a"


@pytest.mark.asyncio
async def test_result_above_the_marking_set_is_rejected() -> None:
    """查询结果带 ``confidential``，包络只有 ``internal`` → 拒。"""
    toolbox = RecordingToolbox(result={"items": [{"rid": "a", "marking": ["confidential"]}]})
    with pytest.raises(ToolNotAllowed) as excinfo:
        await _gate(toolbox).invoke(
            name="ont_object_query", arguments={}, allowed=("ont_object_query",)
        )
    assert excinfo.value.reason == "authority_envelope:markings"


@pytest.mark.asyncio
async def test_unmarked_result_always_passes() -> None:
    """无标记 = 公开数据，任何包络都能看（合取门对空标记恒真）。"""
    toolbox = RecordingToolbox(result={"items": [{"rid": "a", "marking": []}]})
    await _gate(toolbox, Envelope(tools=frozenset({"ont_object_query"}))).invoke(
        name="ont_object_query", arguments={}, allowed=("ont_object_query",)
    )
    assert toolbox.invoked


@pytest.mark.asyncio
async def test_result_marking_can_be_a_bare_string() -> None:
    toolbox = RecordingToolbox(result={"type": {"rid": "t", "marking": "confidential"}})
    with pytest.raises(ToolNotAllowed):
        await _gate(toolbox).invoke(
            name="ont_inspect_class", arguments={}, allowed=("ont_inspect_class",)
        )


@pytest.mark.asyncio
async def test_arguments_carrying_a_marking_above_the_envelope_are_rejected() -> None:
    """写路径同样拦：提议建一个带 ``confidential`` 标记的类型也不行。"""
    toolbox = RecordingToolbox()
    with pytest.raises(ToolNotAllowed) as excinfo:
        await _gate(toolbox).invoke(
            name="ont_propose_model_type",
            arguments={"type_def": {"rid": "t", "marking": ["confidential"]}},
            allowed=("ont_propose_model_type",),
        )
    assert excinfo.value.reason == "authority_envelope:markings"
    assert toolbox.invoked == []
