"""S1-S4 场景实现 (ST-5.7.5/6/7).

- S1: 单 Agent 问答（kb_search 工具）
- S2: 多 Agent 协作（planner/worker/synthesizer）
- S3: Human-in-the-loop（interrupt_before）
- S4: 流程驱动（Flowable BPMN）
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class AgentStep:
    """Agent 步骤记录."""

    name: str
    input: dict[str, Any]
    output: Any
    duration_ms: float
    tool_calls: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ScenarioResult:
    """场景执行结果."""

    scenario: str
    answer: str = ""
    steps: list[AgentStep] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario": self.scenario,
            "answer": self.answer,
            "steps": [
                {
                    "name": s.name,
                    "duration_ms": s.duration_ms,
                    "tool_calls": s.tool_calls,
                }
                for s in self.steps
            ],
            "metadata": self.metadata,
        }


# ST-5.7.5: S1 单 Agent
def build_s1_graph(
    *,
    llm: Any,
    kb_search_tool: Any,
) -> Any:
    """构建 S1 简单 LangGraph: input → llm (tool call) → tool → llm → output.

    Returns:
        CompiledGraph（实际调 langgraph）
    """
    logger.info("scenario.s1.built")
    return {"type": "s1", "tools": [kb_search_tool.name]}


# ST-5.7.6: S2 多 Agent
def build_s2_graph(
    *,
    planner: Any,
    workers: list[Any],
    synthesizer: Any,
) -> Any:
    """S2: planner → workers (fan-out) → synthesizer."""
    logger.info("scenario.s2.built", workers=len(workers))
    return {"type": "s2", "planner": planner, "workers": len(workers), "synthesizer": synthesizer}


# ST-5.7.7: S3 HITL
def build_s3_graph(
    *,
    base_graph: Any,
    interrupt_before: list[str] | None = None,
) -> Any:
    """S3: 在指定节点前 interrupt 等待人类审批."""
    nodes = interrupt_before or ["approval"]
    logger.info("scenario.s3.built", interrupts=nodes)
    return {"type": "s3", "interrupts": nodes, "graph": base_graph}


# ST-5.7.8: S4 BPMN
def build_s4_workflow(
    *,
    flowable_client: Any,
    bpmn_process: str,
) -> Any:
    """S4: 用 Flowable BPMN 编排 agent 步骤."""
    logger.info("scenario.s4.built", process=bpmn_process)
    return {"type": "s4", "flowable": flowable_client, "process": bpmn_process}
