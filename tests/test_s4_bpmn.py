"""S4 BPMN (TC-5.7.8) tests."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for sub in ("mate-common", "mate-tech-rag", "mate-tech-agent"):
    p = str(ROOT / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)

import pytest

from mate_tech_agent.tools.flowable_tool import (
    InMemoryFlowableTool,
    HttpxFlowableTool,
    set_flowable_tool,
)
from mate_tech_agent.graph import (
    build_s4_graph,
    bpmn_deploy_node,
    bpmn_start_node,
    bpmn_monitor_node,
)


@pytest.fixture
def fake_flowable():
    set_flowable_tool(InMemoryFlowableTool())
    yield
    set_flowable_tool(None)


def test_in_memory_deploy_bpmn():
    tool = InMemoryFlowableTool()
    result = tool.deploy_bpmn("test_qa", "<xml/>", name="test")
    assert "id" in result
    assert result["name"] == "test"


def test_in_memory_start_process():
    tool = InMemoryFlowableTool()
    tool.deploy_bpmn("test_qa", "<xml/>")
    inst = tool.start_process("test_qa", variables={"q": "x"})
    assert "id" in inst
    assert inst["process_key"] == "test_qa"
    assert inst["status"] == "running"


def test_in_memory_get_state_not_found():
    tool = InMemoryFlowableTool()
    state = tool.get_process_state("nonexistent")
    assert state["status"] == "not_found"


def test_in_memory_get_state_running():
    tool = InMemoryFlowableTool()
    tool.deploy_bpmn("test_qa", "<xml/>")
    inst = tool.start_process("test_qa")
    state = tool.get_process_state(inst["id"])
    assert state["status"] in ("running", "completed")


def test_httpx_degrades_gracefully_without_server():
    client = HttpxFlowableTool(base_url="http://127.0.0.1:1")
    try:
        assert not client._available
        result = client.deploy_bpmn("test", "<xml/>")
        assert "id" in result
    finally:
        client.close()


def test_s4_graph_compiles():
    assert build_s4_graph() is not None


def test_bpmn_deploy_node(fake_flowable):
    state = {"messages": [{"role": "user", "content": "test"}], "thread_id": "t1"}
    out = bpmn_deploy_node(state)
    assert "deployment_id" in out
    assert out["process_key"] == "agent_qa"


def test_bpmn_start_node(fake_flowable):
    state = {"messages": [{"role": "user", "content": "test"}], "thread_id": "t1", "process_key": "agent_qa", "deployment_id": "d1"}
    out = bpmn_start_node(state)
    assert "process_instance_id" in out
    assert out["process_status"] == "running"


def test_bpmn_monitor_node(fake_flowable):
    state = {"process_instance_id": "nonexistent"}
    out = bpmn_monitor_node(state)
    assert out["process_status"] in ("failed", "not_found")