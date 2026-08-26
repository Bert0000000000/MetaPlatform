"""mate_tech_orchestrator.api.schemas — request/response models."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


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


class CreateOrderRequest(BaseModel):
    """Reference order write used by the local acceptance journey."""

    order_id: str = Field(min_length=1)
    amount_cents: int = Field(gt=0)
    payment_status: Literal["unpaid", "paid"] = "unpaid"


class Order(BaseModel):
    tenant_id: str
    order_id: str
    amount_cents: int = Field(ge=1)
    payment_status: Literal["unpaid", "paid"]
    review_status: Literal["pending", "approved"]
    version: int = Field(ge=1)
    updated_at: datetime


class HighValueUnpaidResponse(BaseModel):
    items: list[Order]
    total: int = Field(ge=0)
    threshold_cents: int = Field(ge=1)


class CreateReviewCaseRequest(BaseModel):
    """Create a proposal from an upstream Ontology/RAG suggestion."""

    order_id: str = Field(min_length=1)
    suggestion: dict[str, Any] = Field(min_length=1)
    source_refs: list[str] = Field(default_factory=list)


class ConfirmActionProposalRequest(BaseModel):
    actor_id: str = Field(default="system", min_length=1)


class RejectActionProposalRequest(BaseModel):
    actor_id: str = Field(default="system", min_length=1)
    reason: str = Field(default="")


class ActionResult(BaseModel):
    proposal_id: str
    order_id: str
    status: Literal["confirmed", "rejected"]
    order_version: int | None = Field(default=None, ge=1)
    follow_up_task_id: str | None = None
    reason: str | None = None


class _EvidenceModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EvidenceGraphNode(_EvidenceModel):
    id: str
    label: str
    type: Literal["transaction_anchor", "object_type", "action_type"]
    properties: dict[str, Any]


class EvidenceGraphEdge(_EvidenceModel):
    id: str
    source: str
    target: str
    label: str


class EvidenceGraph(_EvidenceModel):
    nodes: list[EvidenceGraphNode]
    edges: list[EvidenceGraphEdge]


class EvidenceLegend(_EvidenceModel):
    transaction_anchor: str
    object_type: str
    action_type: str


class OntologyEvidence(_EvidenceModel):
    source: Literal["ontology_kernel"]
    model_rid: str
    action_rid: str
    graph: EvidenceGraph
    legend: EvidenceLegend


class EvidenceFact(_EvidenceModel):
    id: str
    field: str
    label: str
    value: Any
    display_value: str
    source: str


class EvidenceData(_EvidenceModel):
    source: Literal["order_review_orders"]
    captured_at: datetime
    facts: list[EvidenceFact]


class EvidenceDerivation(_EvidenceModel):
    id: str
    label: str
    passed: bool
    fact_refs: list[str]
    details: dict[str, Any] | None = None


class EvidenceRecommendation(_EvidenceModel):
    action: str
    title: str
    reason: str
    requires_confirmation: bool
    derivation_refs: list[str]
    source_refs: list[str]
    confidence: float | None = None


class EvidenceBundle(_EvidenceModel):
    schema_version: Literal["order-review-evidence.v1"]
    status: Literal["complete", "unavailable"]
    proposal_id: str
    order_id: str
    tenant_id: str
    order_version: int
    captured_at: datetime
    ontology: OntologyEvidence
    data: EvidenceData
    derivation: list[EvidenceDerivation]
    recommendation: EvidenceRecommendation


def validate_evidence_bundle(value: Any) -> EvidenceBundle | None:
    """Return the schema-validated bundle, or None for legacy incomplete data."""
    if not isinstance(value, dict):
        return None
    try:
        return EvidenceBundle.model_validate(value)
    except ValidationError:
        return None


class CreateReviewCaseResponse(BaseModel):
    review_case_id: str
    proposal_id: str
    status: Literal["pending"]
    expected_order_version: int
    evidence: EvidenceBundle


class ActionProposal(BaseModel):
    tenant_id: str
    proposal_id: str
    review_case_id: str
    order_id: str
    action_type: Literal["order_review_confirm"]
    status: Literal["pending", "confirmed", "rejected", "expired"]
    expected_order_version: int
    suggestion: dict[str, Any]
    source_refs: list[str]
    parameters: dict[str, Any]
    evidence: EvidenceBundle | None = None
    expires_at: datetime
    created_at: datetime
    resolved_at: datetime | None = None
