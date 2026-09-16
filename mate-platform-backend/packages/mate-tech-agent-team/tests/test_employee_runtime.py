"""任务 2 · 数字员工运行时的验收用例。

判据（来自 GOAL 任务 2）：
  - 同一句话派给两个不同员工，产出**内容不同且真实**
  - 负例：白名单外的工具调用必须被拒

"真实"在这里是可断言的：产出不等于指令、模型确实被调用过、工具调用真的落到
了 MCP 中心（而不是被 local echo 糊过去）。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest
from mate_tech_agent_team import (
    LlmEmployeeRuntime,
    ProfileRegistry,
    SkillCatalog,
    SubTask,
    ToolNotAllowed,
    builtin_profiles,
    to_openai_schema,
)
from mate_tech_agent_team.toolbox import McpToolbox

# ── 替身 ────────────────────────────────────────────────────────────────


class FakeLlm:
    """按脚本回话的 LLM 网关替身；记录每次收到的 messages。"""

    def __init__(self, script: list[dict[str, Any]]) -> None:
        self.script = list(script)
        self.calls: list[dict[str, Any]] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append({"messages": messages, "model": model, "tools": tools})
        if self.script:
            return self.script.pop(0)
        return {"content": "(no more scripted replies)", "tool_calls": []}


class FakeMcp:
    """MCP 中心替身：记录真实被派发的工具调用。"""

    def __init__(self, descriptors: list[dict[str, Any]]) -> None:
        self.descriptors = descriptors
        self.invoked: list[tuple[str, dict[str, Any]]] = []

    async def list_tools(self) -> list[dict[str, Any]]:
        return self.descriptors

    async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> Any:
        self.invoked.append((name, arguments))
        return {"rows": [{"id": f"{name}-row"}], "name": name}


DESCRIPTORS = [
    {
        "name": "ont_object_query",
        "description": "查询对象",
        "inputSchema": {"type": "object", "properties": {"q": {"type": "string"}}},
        "agentInvokable": True,
    },
    {
        "name": "ont_confirm_proposal",
        "description": "确认提案（人工闸门）",
        "inputSchema": {"type": "object", "properties": {}},
        "agentInvokable": False,
    },
    {
        "name": "kb_search",
        "description": "知识库检索",
        "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}}},
        "agentInvokable": True,
    },
]


@dataclass
class _Skill:
    id: str
    name: str
    description: str
    content: str


class FakeSkillStore:
    def __init__(self, skills: list[_Skill]) -> None:
        self._by_id = {s.id: s for s in skills}

    def get(self, skill_id: str) -> _Skill | None:
        return self._by_id.get(skill_id)


def _runtime(llm: FakeLlm, mcp: FakeMcp, skills: SkillCatalog | None = None) -> LlmEmployeeRuntime:
    return LlmEmployeeRuntime(
        registry=ProfileRegistry(builtin_profiles()),
        llm_factory=lambda tenant_id: llm,
        toolbox_factory=lambda tenant_id: McpToolbox(mcp),
        skills=skills,
    )


def _subtask(profile_id: str, instruction: str = "分析本月异常订单") -> SubTask:
    return SubTask(task_id="t1", profile_id=profile_id, instruction=instruction, depends_on=[])


# ── 判据：同一句话，两个员工，产出不同且真实 ─────────────────────────────


@pytest.mark.asyncio
async def test_same_instruction_two_employees_give_different_real_outputs() -> None:
    instruction = "分析本月异常订单"
    analyst_llm = FakeLlm(
        [{"content": "本月异常订单 37 笔，集中在华东仓，金额占比 12%。", "tool_calls": []}]
    )
    auditor_llm = FakeLlm(
        [{"content": "存疑项：37 笔的口径未说明是否含已退单。建议核对退款流水。", "tool_calls": []}]
    )

    analyst = await _runtime(analyst_llm, FakeMcp(DESCRIPTORS)).run(
        subtask=_subtask("EMP-ANALYST", instruction), tenant_id="tenant-a"
    )
    auditor = await _runtime(auditor_llm, FakeMcp(DESCRIPTORS)).run(
        subtask=_subtask("EMP-AUDITOR", instruction), tenant_id="tenant-a"
    )

    assert analyst["status"] == "ok" and auditor["status"] == "ok"
    # 1) 产出内容不同
    assert analyst["output"] != auditor["output"]
    # 2) 产出不是原话回填（治 D-10 的假回执）
    assert analyst["output"] != instruction
    assert auditor["output"] != instruction
    # 3) 真的调过模型
    assert analyst["source"] == "llm" and analyst["llm_calls"] >= 1
    assert auditor["source"] == "llm" and auditor["llm_calls"] >= 1


@pytest.mark.asyncio
async def test_each_employee_sends_its_own_system_prompt() -> None:
    """身份不同 = 提示词不同。发出去的是**该员工的**提示词，不是通用模板。"""
    analyst_llm = FakeLlm([{"content": "A", "tool_calls": []}])
    auditor_llm = FakeLlm([{"content": "B", "tool_calls": []}])
    await _runtime(analyst_llm, FakeMcp(DESCRIPTORS)).run(
        subtask=_subtask("EMP-ANALYST"), tenant_id="tenant-a"
    )
    await _runtime(auditor_llm, FakeMcp(DESCRIPTORS)).run(
        subtask=_subtask("EMP-AUDITOR"), tenant_id="tenant-a"
    )

    analyst_system = analyst_llm.calls[0]["messages"][0]["content"]
    auditor_system = auditor_llm.calls[0]["messages"][0]["content"]
    assert "数据分析师" in analyst_system
    assert "合规核对员" in auditor_system
    assert analyst_system != auditor_system


@pytest.mark.asyncio
async def test_unknown_employee_yields_error_not_fake_success() -> None:
    result = await _runtime(FakeLlm([]), FakeMcp(DESCRIPTORS)).run(
        subtask=_subtask("EMP-NOT-EXIST"), tenant_id="tenant-a"
    )
    assert result["status"] == "error"
    assert "员工不存在" in result["error"]


# ── 工具面：真实派发 ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_tool_calls_are_really_dispatched_to_the_center() -> None:
    llm = FakeLlm(
        [
            {
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "ont_object_query", "arguments": '{"q": "订单"}'},
                    }
                ],
            },
            {"content": "查到 1 条。", "tool_calls": []},
        ]
    )
    mcp = FakeMcp(DESCRIPTORS)
    result = await _runtime(llm, mcp).run(subtask=_subtask("EMP-ANALYST"), tenant_id="tenant-a")

    assert result["status"] == "ok"
    assert mcp.invoked == [("ont_object_query", {"q": "订单"})]
    assert result["llm_calls"] == 2  # 一轮决策 + 一轮总结
    assert result["tool_calls"][0]["allowed"] is True


@pytest.mark.asyncio
async def test_only_whitelisted_tool_schemas_are_offered() -> None:
    llm = FakeLlm([{"content": "ok", "tool_calls": []}])
    await _runtime(llm, FakeMcp(DESCRIPTORS)).run(
        subtask=_subtask("EMP-RESEARCHER"), tenant_id="tenant-a"
    )
    offered = {t["function"]["name"] for t in (llm.calls[0]["tools"] or [])}
    # 研究员的白名单里没有本体查询工具
    assert "ont_object_query" not in offered
    assert "kb_search" in offered


# ── 负例：白名单外的调用必须被拒 ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_tool_outside_whitelist_is_rejected_and_never_reaches_center() -> None:
    """模型硬要调一个白名单外的工具 —— 拒绝，且**不落网**。"""
    llm = FakeLlm(
        [
            {
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "kb_search", "arguments": '{"query": "找点东西"}'},
                    }
                ],
            },
            {"content": "改用可用工具后的结论。", "tool_calls": []},
        ]
    )
    mcp = FakeMcp(DESCRIPTORS)
    # 分析师的白名单里没有 kb_search
    result = await _runtime(llm, mcp).run(subtask=_subtask("EMP-ANALYST"), tenant_id="tenant-a")

    assert mcp.invoked == [], f"白名单外的工具竟然打到了中心：{mcp.invoked}"
    rejected = [t for t in result["tool_calls"] if t["allowed"] is False]
    assert len(rejected) == 1
    assert rejected[0]["rejected"] == "not_in_employee_tool_whitelist"
    assert result["status"] == "ok"


@pytest.mark.asyncio
async def test_center_agent_invokable_false_is_also_rejected() -> None:
    """即使被写进白名单，人工闸门类工具（confirm/reject/execute）也必须拒。"""
    mcp = FakeMcp(DESCRIPTORS)
    toolbox = McpToolbox(mcp)
    with pytest.raises(ToolNotAllowed) as excinfo:
        await toolbox.invoke(
            name="ont_confirm_proposal",
            arguments={},
            allowed=("ont_confirm_proposal",),  # 故意放进白名单
        )
    assert excinfo.value.reason == "center_marks_not_agent_invokable"
    assert mcp.invoked == []


@pytest.mark.asyncio
async def test_not_agent_invokable_tool_is_not_offered_to_the_model() -> None:
    toolbox = McpToolbox(FakeMcp(DESCRIPTORS))
    schemas = await toolbox.schemas(allowed=("ont_confirm_proposal", "ont_object_query"))
    assert [s["function"]["name"] for s in schemas] == ["ont_object_query"]


def test_schema_conversion_shape() -> None:
    schema = to_openai_schema(DESCRIPTORS[0])
    assert schema["type"] == "function"
    assert schema["function"]["name"] == "ont_object_query"
    assert schema["function"]["parameters"]["properties"]["q"]["type"] == "string"


# ── 技能清单进提示词（正文不进）───────────────────────────────────────────


@pytest.mark.asyncio
async def test_skill_manifest_goes_into_prompt_but_content_does_not() -> None:
    store = FakeSkillStore(
        [
            _Skill(
                "sk-order-anomaly",
                "异常订单识别",
                "识别异常订单的口径与阈值",
                "正文：阈值 = 3σ …" * 50,
            )
        ]
    )
    llm = FakeLlm([{"content": "ok", "tool_calls": []}])
    await _runtime(llm, FakeMcp(DESCRIPTORS), skills=SkillCatalog(store)).run(
        subtask=_subtask("EMP-ANALYST"), tenant_id="tenant-a"
    )
    system = llm.calls[0]["messages"][0]["content"]
    assert "sk-order-anomaly" in system
    assert "异常订单识别" in system
    assert "阈值 = 3σ" not in system, "技能正文不该常驻提示词（渐进加载第 1 层只出清单）"
