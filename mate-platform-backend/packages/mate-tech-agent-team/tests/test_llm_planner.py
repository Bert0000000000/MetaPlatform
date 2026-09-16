"""任务 2 · 真实拆解（LLM 任务图）的验收用例。

守住一件事：**"模型没按格式答"不能被伪装成"拆解成功"**。
模型返回不可用的东西时必须抛 :class:`PlanError`，而不是回落到写死的模板。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from mate_tech_agent_team import LlmPlanner, PlanError, builtin_profiles


class StubLlm:
    def __init__(self, content: str) -> None:
        self.content = content
        self.calls: list[dict[str, Any]] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append({"messages": messages, "model": model})
        return {"content": self.content, "tool_calls": []}


def _planner(content: str) -> LlmPlanner:
    return LlmPlanner(llm_factory=lambda tenant_id: StubLlm(content), roster=builtin_profiles())


async def _plan(content: str, *, max_parallel: int = 3):
    return await _planner(content).plan(
        goal="把本月的异常订单找出来，逐个分析原因", max_parallel=max_parallel, tenant_id="tenant-a"
    )


@pytest.mark.asyncio
async def test_parses_a_valid_plan() -> None:
    content = json.dumps(
        {
            "subtasks": [
                {"profile_id": "EMP-ANALYST", "instruction": "统计本月异常订单的数量与金额分布"},
                {"profile_id": "EMP-AUDITOR", "instruction": "核对这些异常订单的判定口径是否一致"},
            ]
        }
    )
    subtasks = await _plan(content)
    assert [s["profile_id"] for s in subtasks] == ["EMP-ANALYST", "EMP-AUDITOR"]
    assert [s["task_id"] for s in subtasks] == ["t1", "t2"]
    assert all(s["depends_on"] == [] for s in subtasks), "1.0 只做一层并行，不许有依赖"


@pytest.mark.asyncio
async def test_tolerates_markdown_fenced_json() -> None:
    content = (
        "```json\n"
        + json.dumps(
            {
                "subtasks": [
                    {"profile_id": "EMP-ANALYST", "instruction": "分析 A"},
                    {"profile_id": "EMP-RESEARCHER", "instruction": "补充 B"},
                ]
            }
        )
        + "\n```"
    )
    subtasks = await _plan(content)
    assert len(subtasks) == 2


@pytest.mark.asyncio
async def test_unknown_profile_is_dropped_and_too_few_raises() -> None:
    content = json.dumps(
        {
            "subtasks": [
                {"profile_id": "EMP-ANALYST", "instruction": "分析 A"},
                {"profile_id": "EMP-NOT-EXIST", "instruction": "分析 B"},
            ]
        }
    )
    with pytest.raises(PlanError, match="≥2"):
        await _plan(content)


@pytest.mark.asyncio
async def test_same_employee_twice_is_deduplicated() -> None:
    """同一句话派给同一个员工两次不是"并行"，是重复劳动。"""
    content = json.dumps(
        {
            "subtasks": [
                {"profile_id": "EMP-ANALYST", "instruction": "分析 A"},
                {"profile_id": "EMP-ANALYST", "instruction": "分析 B"},
            ]
        }
    )
    with pytest.raises(PlanError, match="≥2"):
        await _plan(content)


@pytest.mark.asyncio
async def test_non_json_reply_raises_instead_of_falling_back() -> None:
    with pytest.raises(PlanError, match="不是 JSON"):
        await _plan("好的，我来帮你分析这个月的订单。首先我们需要……")


@pytest.mark.asyncio
async def test_max_parallel_caps_the_plan() -> None:
    content = json.dumps(
        {
            "subtasks": [
                {"profile_id": "EMP-ANALYST", "instruction": "A"},
                {"profile_id": "EMP-AUDITOR", "instruction": "B"},
                {"profile_id": "EMP-RESEARCHER", "instruction": "C"},
            ]
        }
    )
    subtasks = await _plan(content, max_parallel=2)
    assert len(subtasks) == 2


@pytest.mark.asyncio
async def test_roster_reaches_the_model() -> None:
    content = json.dumps(
        {
            "subtasks": [
                {"profile_id": "EMP-ANALYST", "instruction": "A"},
                {"profile_id": "EMP-AUDITOR", "instruction": "B"},
            ]
        }
    )
    llm = StubLlm(content)
    planner = LlmPlanner(llm_factory=lambda tenant_id: llm, roster=builtin_profiles())
    await planner.plan(goal="目标", max_parallel=3, tenant_id="tenant-a")
    system = llm.calls[0]["messages"][0]["content"]
    assert "EMP-ANALYST" in system and "EMP-AUDITOR" in system
