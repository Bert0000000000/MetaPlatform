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
    TransientRunError,
    builtin_profiles,
    to_openai_schema,
)
from mate_tech_agent_team.toolbox import McpToolbox

from mate_clients.llmgw import LlmgwError

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


# ── 工具预算耗尽也必须给结论（否则是另一种"空回执"）────────────────────


class AlwaysToolsLlm:
    """永远要工具、从不给最终答复的模型——用来把工具轮次预算耗光。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append({"tools": tools})
        if tools:
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": f"c{len(self.calls)}",
                        "type": "function",
                        "function": {"name": "ont_list_classes", "arguments": "{}"},
                    }
                ],
            }
        return {"content": "预算用尽后的最终答复。", "tool_calls": []}


@pytest.mark.asyncio
async def test_exhausted_tool_budget_still_yields_a_final_answer() -> None:
    """工具轮次用尽时，必须再要一次**纯文本**答复。

    否则员工会以 status=ok 返回空产出——跑是跑完了，但什么也没说，
    这本身就是另一种"假回执"（实测：研究员连调 8 次知识库后产出为空字符串）。
    """
    llm = AlwaysToolsLlm()
    runtime = LlmEmployeeRuntime(
        registry=ProfileRegistry(builtin_profiles()),
        llm_factory=lambda _t: llm,
        toolbox_factory=lambda _t: McpToolbox(FakeMcp(DESCRIPTORS)),
        max_tool_rounds=2,
    )
    result = await runtime.run(subtask=_subtask("EMP-ANALYST"), tenant_id="tenant-a")

    assert result["status"] == "ok"
    assert result["output"].strip(), "预算耗尽的员工不该返回空产出"
    assert result["output"] == "预算用尽后的最终答复。"
    # 最后一次调用必须**不带工具**——那正是逼它给结论的手段
    assert llm.calls[-1]["tools"] is None


# ── 1.5 任务 4：运行期故障的**可重试分类** ──────────────────────────────


class ExplodingLlm(FakeLlm):
    """一上来就抛给定的异常（模拟网关 5xx / 传输错 / 请求不合法）。"""

    def __init__(self, exc: Exception) -> None:
        super().__init__([])
        self.exc = exc

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        raise self.exc


class ToolThenExplodeLlm(FakeLlm):
    """先派一次工具，之后再抛错——用来验"已经调过工具就不重试"。"""

    def __init__(self, exc: Exception) -> None:
        super().__init__(
            [
                {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "c1",
                            "type": "function",
                            "function": {
                                "name": "ont_object_query",
                                "arguments": '{"q": "订单"}',
                            },
                        }
                    ],
                }
            ]
        )
        self.exc = exc

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        if not self.script:
            raise self.exc
        return await super().chat_with_tools(
            messages=messages, model=model, tools=tools, temperature=temperature
        )


@pytest.mark.asyncio
async def test_a_retryable_upstream_failure_is_signalled_to_the_graph() -> None:
    """上游**可能自己好**的失败（传输错 / 429 / 5xx）抛 ``TransientRunError``，
    由图按策略重试——不是吞成一条"这件没干成"。"""
    llm = ExplodingLlm(LlmgwError("llmgw returned 503: upstream busy", retryable=True))
    with pytest.raises(TransientRunError):
        await _runtime(llm, FakeMcp(DESCRIPTORS)).run(
            subtask=_subtask("EMP-ANALYST"), tenant_id="tenant-a"
        )


@pytest.mark.asyncio
async def test_a_permanent_upstream_failure_stays_a_normal_error_receipt() -> None:
    """4xx 这种"重试多少次都一样"的失败照旧记 error 回执，不抛。"""
    llm = ExplodingLlm(LlmgwError("llmgw returned 400: bad request"))
    result = await _runtime(llm, FakeMcp(DESCRIPTORS)).run(
        subtask=_subtask("EMP-ANALYST"), tenant_id="tenant-a"
    )
    assert result["status"] == "error"
    assert "400" in result["error"]


@pytest.mark.asyncio
async def test_a_failure_after_a_tool_call_is_not_signalled_as_retryable() -> None:
    """**已经调过工具**之后才炸 → 不抛 TransientRunError，记 error 回执。

    这是"已产生副作用的节点不得盲目重跑"在执行侧的那一半：工具可能已经写过
    东西，重试等于把它再做一遍。
    """
    mcp = FakeMcp(DESCRIPTORS)
    llm = ToolThenExplodeLlm(LlmgwError("llmgw transport error: gone", retryable=True))
    result = await _runtime(llm, mcp).run(subtask=_subtask("EMP-ANALYST"), tenant_id="tenant-a")

    assert mcp.invoked, "前置条件：这次运行真的调过工具"
    assert result["status"] == "error"
    assert result["tool_calls"], "失败回执要带上已经发生的工具调用"
