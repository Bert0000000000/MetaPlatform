"""mate_tech_orchestrator.api.schemas — request/response models."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CapabilityBindingRequest(BaseModel):
    """One capability of a digital-employee role → worker binding."""

    name: str = Field(min_length=1)
    worker_kind: Literal["mcp", "a2a", "http", "local"]
    ref: str = Field(default="")


class RegisterRoleRequest(BaseModel):
    """Body for POST /api/v1/orchestrator/roles."""

    role: str = Field(min_length=1, description="kernel AgentRole slug")
    name: str = Field(default="")
    capabilities: list[CapabilityBindingRequest] = Field(default_factory=list)


class TrackCapabilityRequest(BaseModel):
    """Body for POST /api/v1/orchestrator/capabilities (MP-COMP-01)."""

    name: str = Field(min_length=1, description="capability name (e.g. MCP tool name)")
    ref: str = Field(min_length=1, description="worker reference (e.g. MCP tool ref)")


class DispatchRequest(BaseModel):
    """Body for POST /api/v1/orchestrator/dispatch."""

    target_rid: str | None = Field(default=None, description="rid prefix selects the role")
    capability: str | None = Field(default=None)
    action: str = Field(default="")
    arguments: dict[str, Any] = Field(default_factory=dict)


class PlanStepRequest(BaseModel):
    """One step of a submitted plan."""

    step_id: str = Field(min_length=1)
    # MP-SAL-05：全部 5 种 StepKind 经 REST 提交（call_agent / apply_action /
    # propose / run_function / evaluate_object_set）
    kind: Literal[
        "call_agent", "apply_action", "propose", "run_function", "evaluate_object_set",
    ] = "call_agent"
    target: str = Field(min_length=1, description="rid / capability for the step")
    payload: dict[str, Any] = Field(default_factory=dict)
    requires_hitl: bool = False


class SubmitPlanRequest(BaseModel):
    """Body for POST /api/v1/orchestrator/plans."""

    author_user_id: str = Field(default="system")
    steps: list[PlanStepRequest] = Field(min_length=1)


class ReviewRequest(BaseModel):
    """Body for POST /api/v1/orchestrator/plans/{plan_id}/steps/{step_id}/review."""

    approved: bool
    feedback: str = Field(default="")


class PlanStepStatus(BaseModel):
    """Serialized step result for plan status reads."""

    step_id: str
    status: str
    output: Any | None = None
    error: str | None = None


class PlanStatus(BaseModel):
    """Serialized plan state."""

    plan_id: str
    author_user_id: str
    current_step_id: str | None = None
    aborted: bool = False
    history: list[PlanStepStatus] = Field(default_factory=list)


class GraphNode(BaseModel):
    """MP-SAL-05 可视化：流程图节点（含实时状态与 proposal 关联）。"""

    id: str
    kind: str
    target: str
    hitl: bool
    status: str  # pending | running | completed | failed | hitl_waiting | skipped
    proposal_id: str | None = None
    expected_diff: dict[str, Any] | None = None
    impact_summary: str = ""


class GraphEdge(BaseModel):
    """MP-SAL-05 可视化：顺序边 + 数据流引用标注。"""

    from_step: str
    to_step: str
    data_refs: list[str] = Field(default_factory=list)


class PlanGraph(BaseModel):
    """GET /plans/{plan_id}/graph —— 前端流程图渲染模型。"""

    plan_id: str
    status: str
    current_step_id: str | None = None
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
