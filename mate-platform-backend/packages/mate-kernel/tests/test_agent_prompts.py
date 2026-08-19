"""7+N 数字员工 system prompt 注册表（prompts.py）测试。"""

from __future__ import annotations

import pytest

from mate_kernel.agent.orchestrator import AgentRole
from mate_kernel.agent.prompts import SYSTEM_PROMPTS

# 每个 role 的 prompt 必须包含的身份关键词（与实现能力对应）
_IDENTITY_MARKERS: dict[AgentRole, tuple[str, ...]] = {
    # M3 LLM-driven：proposal 状态机 + 6 种 action_kind
    AgentRole.ONTOLOGY: (
        "本体员工", "propose_object_type", "propose_instance",
        "merge_suggestion", "proposal_id",
    ),
    AgentRole.WORKFLOW: ("工作流员工", "FlowDefinition", "WaitUser", "AWAITING_USER"),
    AgentRole.APP: ("应用员工", "PageManifest", "slot", "action_button"),
    AgentRole.DATA_PRODUCT: ("数据产品员工", "DataProduct", "LineageEdge", "QualitySummary"),
    AgentRole.OBS: ("可观测员工", "AlertRule", "AlertEvent", "audit_id"),
    AgentRole.SECURITY: ("安全员工", "allow", "deny", "abstain", "rule_id"),
    AgentRole.KNOWLEDGE: ("知识库员工", "KbDocument", "RAG", "matched_via_class"),
    AgentRole.SUPERAI: ("SuperAI Copilot", "PlanSpec", "HITL", "AgentRole"),
}

# 7+N 边界：全局必须出现的关键决策标识
_COMMON_BOUNDARIES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("tenant 隔离", ("tenant",)),
    ("AI 不直连业务表", ("ActionType.apply",)),
)


def test_all_agent_roles_have_prompts() -> None:
    # 7+N：8 个 AgentRole 全部覆盖（7 内置 + 1 COPILOT）
    assert set(SYSTEM_PROMPTS) == set(AgentRole)


def test_each_prompt_carries_its_identity() -> None:
    for role, markers in _IDENTITY_MARKERS.items():
        prompt = SYSTEM_PROMPTS[role]
        missing = [m for m in markers if m not in prompt]
        assert not missing, f"{role.value} prompt 缺少身份关键词: {missing}"


def test_common_boundaries_present() -> None:
    # 平台硬边界应出现在对应员工/编排 prompt 里
    assert "HITL" in SYSTEM_PROMPTS[AgentRole.SUPERAI]
    assert "L3" in SYSTEM_PROMPTS[AgentRole.SUPERAI]
    assert "tenant" in SYSTEM_PROMPTS[AgentRole.SECURITY]
    assert "当前 tenant" in SYSTEM_PROMPTS[AgentRole.ONTOLOGY]
    assert "manager.track" in SYSTEM_PROMPTS[AgentRole.WORKFLOW]


def test_prompts_are_non_empty_and_typed() -> None:
    for role, prompt in SYSTEM_PROMPTS.items():
        assert isinstance(prompt, str)
        assert prompt.strip(), f"{role.value} prompt 为空"
