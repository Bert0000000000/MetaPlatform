"""Scenario factory tests (ST-5.7.5/6/7/8)."""
from __future__ import annotations

from unittest.mock import MagicMock

from mate_tech_agent.scenarios.s1_s4 import (
    AgentStep,
    ScenarioResult,
    build_s1_graph,
    build_s2_graph,
    build_s3_graph,
    build_s4_workflow,
)


def test_build_s1_graph() -> None:
    g = build_s1_graph(llm=MagicMock(), kb_search_tool=MagicMock(name="kb_search"))
    assert g["type"] == "s1"
    assert "kb_search" in g["tools"]


def test_build_s2_graph() -> None:
    g = build_s2_graph(
        planner=MagicMock(),
        workers=[MagicMock(), MagicMock()],
        synthesizer=MagicMock(),
    )
    assert g["type"] == "s2"
    assert g["workers"] == 2


def test_build_s3_graph_default_interrupt() -> None:
    base = MagicMock()
    g = build_s3_graph(base_graph=base)
    assert g["type"] == "s3"
    assert "approval" in g["interrupts"]


def test_build_s3_graph_custom_interrupt() -> None:
    g = build_s3_graph(base_graph=MagicMock(), interrupt_before=["node_a", "node_b"])
    assert g["interrupts"] == ["node_a", "node_b"]


def test_build_s4_workflow() -> None:
    g = build_s4_workflow(flowable_client=MagicMock(), bpmn_process="agent-decision")
    assert g["type"] == "s4"
    assert g["process"] == "agent-decision"


def test_agent_step_dataclass() -> None:
    s = AgentStep(name="step1", input={"x": 1}, output="ok", duration_ms=10.0)
    assert s.tool_calls == []


def test_scenario_result_to_dict() -> None:
    r = ScenarioResult(scenario="S1", answer="42")
    d = r.to_dict()
    assert d["scenario"] == "S1"
    assert d["answer"] == "42"
