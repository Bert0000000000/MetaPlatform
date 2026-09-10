"""Server-owned validation for Action Orchestration Plan JSON.

The browser may edit a draft, but the node kinds, ActionTypes and execution
rules live here.  This module deliberately contains no BPMN or Temporal
details; it validates only the stable business Plan contract.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class PlanValidationIssue:
    node_id: str | None
    field: str
    code: str
    message: str

    def to_dict(self) -> dict[str, str | None]:
        return {
            "node_id": self.node_id,
            "field": self.field,
            "code": self.code,
            "message": self.message,
        }


@dataclass(frozen=True, slots=True)
class PlanValidationResult:
    issues: tuple[PlanValidationIssue, ...]

    @property
    def valid(self) -> bool:
        return not self.issues

    def to_dict(self) -> dict[str, Any]:
        return {"valid": self.valid, "issues": [issue.to_dict() for issue in self.issues]}


# This is intentionally a small, explicit allow-list for the v1 order-review
# closure.  Adding an ActionType requires a server change and an audit review.
ACTION_TYPE_REGISTRY: dict[str, dict[str, Any]] = {
    "order.review": {"required_inputs": ("order_id",), "requires_confirmation": True},
    "follow_up.create": {"required_inputs": ("review_case_id",), "requires_confirmation": False},
    "action.apply": {"required_inputs": ("proposal_id",), "requires_confirmation": True},
}
NODE_TYPES = frozenset({"start", "action", "end"})


def node_registry() -> list[dict[str, Any]]:
    """Expose UI-safe node metadata; never expose worker internals."""
    return [
        {"type": "start", "label": "Start", "editable_fields": ()},
        {
            "type": "action",
            "label": "Action",
            "editable_fields": ("action_type", "input", "requires_confirmation"),
            "action_types": [
                {
                    "action_type": action_type,
                    "required_inputs": list(spec["required_inputs"]),
                    "requires_confirmation": spec["requires_confirmation"],
                }
                for action_type, spec in ACTION_TYPE_REGISTRY.items()
            ],
        },
        {"type": "end", "label": "End", "editable_fields": ()},
    ]


def validate_plan(plan: dict[str, Any]) -> PlanValidationResult:
    """Validate a graph and return user-safe, field-level issues."""
    issues: list[PlanValidationIssue] = []
    nodes = plan.get("nodes") if isinstance(plan, dict) else None
    edges = plan.get("edges") if isinstance(plan, dict) else None
    if not isinstance(nodes, list):
        return PlanValidationResult(
            (PlanValidationIssue(None, "nodes", "required", "nodes must be a list"),)
        )
    if not isinstance(edges, list):
        return PlanValidationResult(
            (PlanValidationIssue(None, "edges", "required", "edges must be a list"),)
        )

    by_id: dict[str, dict[str, Any]] = {}
    start_ids: list[str] = []
    end_ids: list[str] = []
    for index, raw_node in enumerate(nodes):
        if not isinstance(raw_node, dict):
            issues.append(
                PlanValidationIssue(
                    None, "nodes", "invalid_node", f"node {index} must be an object"
                )
            )
            continue
        node_id = str(raw_node.get("id") or "").strip()
        if not node_id:
            issues.append(PlanValidationIssue(None, "id", "required", "each node requires an id"))
            continue
        if node_id in by_id:
            issues.append(
                PlanValidationIssue(node_id, "id", "duplicate_node_id", "node ids must be unique")
            )
            continue
        by_id[node_id] = raw_node
        node_type = str(raw_node.get("type") or "").strip()
        if node_type not in NODE_TYPES:
            issues.append(
                PlanValidationIssue(
                    node_id, "type", "unknown_node_type", "node type is not allowed"
                )
            )
            continue
        if node_type == "start":
            start_ids.append(node_id)
        elif node_type == "end":
            end_ids.append(node_id)
        elif node_type == "action":
            _validate_action_node(raw_node, node_id, issues)

    if len(start_ids) != 1:
        issues.append(
            PlanValidationIssue(
                None, "nodes", "start_node_count", "plan requires exactly one start node"
            )
        )
    if len(end_ids) != 1:
        issues.append(
            PlanValidationIssue(
                None, "nodes", "end_node_count", "plan requires exactly one end node"
            )
        )

    outgoing: dict[str, set[str]] = {node_id: set() for node_id in by_id}
    incoming: dict[str, set[str]] = {node_id: set() for node_id in by_id}
    for index, raw_edge in enumerate(edges):
        if not isinstance(raw_edge, dict):
            issues.append(
                PlanValidationIssue(
                    None, "edges", "invalid_edge", f"edge {index} must be an object"
                )
            )
            continue
        source = str(raw_edge.get("source") or "").strip()
        target = str(raw_edge.get("target") or "").strip()
        if source not in by_id or target not in by_id:
            issues.append(
                PlanValidationIssue(
                    None, "edges", "unknown_edge_endpoint", "edge references an unknown node"
                )
            )
            continue
        if by_id[source].get("type") == "end" or by_id[target].get("type") == "start":
            issues.append(
                PlanValidationIssue(
                    None,
                    "edges",
                    "invalid_connection",
                    "end cannot have outputs and start cannot have inputs",
                )
            )
            continue
        outgoing[source].add(target)
        incoming[target].add(source)

    for node_id, node in by_id.items():
        node_type = node.get("type")
        if node_type != "start" and not incoming[node_id]:
            issues.append(
                PlanValidationIssue(
                    node_id, "edges", "missing_incoming_edge", "node must have an incoming edge"
                )
            )
        if node_type != "end" and not outgoing[node_id]:
            issues.append(
                PlanValidationIssue(
                    node_id, "edges", "missing_outgoing_edge", "node must have an outgoing edge"
                )
            )
        if len(outgoing[node_id]) > 1 or len(incoming[node_id]) > 1:
            issues.append(
                PlanValidationIssue(
                    node_id, "edges", "branching_not_supported", "v1 plans must be linear"
                )
            )

    if len(start_ids) == 1 and len(end_ids) == 1:
        reachable = _reachable(start_ids[0], outgoing)
        if end_ids[0] not in reachable:
            issues.append(
                PlanValidationIssue(
                    end_ids[0],
                    "edges",
                    "end_not_reachable",
                    "end node must be reachable from start",
                )
            )
        for node_id in by_id:
            if node_id not in reachable:
                issues.append(
                    PlanValidationIssue(
                        node_id, "edges", "unreachable_node", "node is not reachable from start"
                    )
                )

    return PlanValidationResult(tuple(issues))


def _validate_action_node(
    node: dict[str, Any],
    node_id: str,
    issues: list[PlanValidationIssue],
) -> None:
    action_type = str(node.get("action_type") or "").strip()
    spec = ACTION_TYPE_REGISTRY.get(action_type)
    if spec is None:
        issues.append(
            PlanValidationIssue(
                node_id, "action_type", "unknown_action_type", "action type is not allowed"
            )
        )
        return
    inputs = node.get("input")
    if not isinstance(inputs, dict):
        issues.append(
            PlanValidationIssue(node_id, "input", "invalid_input", "input must be an object")
        )
        return
    for field in spec["required_inputs"]:
        if not str(inputs.get(field) or "").strip():
            issues.append(
                PlanValidationIssue(node_id, f"input.{field}", "required", f"{field} is required")
            )
    if spec["requires_confirmation"] and node.get("requires_confirmation") is not True:
        issues.append(
            PlanValidationIssue(
                node_id,
                "requires_confirmation",
                "confirmation_required",
                "this action requires confirmation",
            )
        )


def _reachable(start: str, outgoing: dict[str, set[str]]) -> set[str]:
    visited: set[str] = set()
    todo = [start]
    while todo:
        node_id = todo.pop()
        if node_id in visited:
            continue
        visited.add(node_id)
        todo.extend(outgoing.get(node_id, ()))
    return visited
