"""Deterministic evidence bundle construction for order review."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

EVIDENCE_SCHEMA_VERSION = "order-review-evidence.v1"

_FOLLOW_UP_ACTION = "follow_up_payment"
_FOLLOW_UP_TITLE = "创建回款跟进单"
_FOLLOW_UP_POLICY_REF = "policy://payment-follow-up-policy"
_THRESHOLD_CENTS = 100_000
_DISPLAY_VALUE_MAPPINGS = {
    "fact.payment_status": {
        "unpaid": "未支付",
        "paid": "已支付",
    },
    "fact.review_status": {
        "pending": "待复核",
        "approved": "已批准",
    },
}
_FACT_METADATA = {
    "fact.amount_cents": ("amount_cents", "订单金额"),
    "fact.payment_status": ("payment_status", "支付状态"),
    "fact.review_status": ("review_status", "复核状态"),
    "fact.version": ("version", "订单版本"),
}
_ONTOLOGY_LEGEND = {
    "transaction_anchor": "订单交易事实的语义锚点，不是已持久化的 Ontology Individual",
    "object_type": "来自 Ontology Kernel 的正式对象模型",
    "action_type": "来自 Ontology Kernel 的订单复核动作定义",
}


@dataclass(frozen=True)
class OrderReviewFacts:
    tenant_id: str
    order_id: str
    amount_cents: int
    payment_status: str
    review_status: str
    version: int
    updated_at: datetime


@dataclass(frozen=True)
class OntologyContract:
    object_type: dict[str, Any]
    action_type: dict[str, Any]


class EvidenceUnavailable(RuntimeError):  # noqa: N818 - public API mandated by the task brief
    """Raised when the order-review evidence bundle cannot be built."""


def _expected_object_rid(tenant_id: str) -> str:
    return f"ont.{tenant_id}.obj.crm.order.v1"


def _expected_action_rid(tenant_id: str) -> str:
    return f"ont.{tenant_id}.act.order-review-confirm.v1"


def _format_amount(amount_cents: int) -> str:
    sign = "-" if amount_cents < 0 else ""
    absolute_cents = abs(amount_cents)
    yuan, cents = divmod(absolute_cents, 100)
    return f"{sign}¥{yuan:,}.{cents:02d}"


def _confidence_metadata(requested_suggestion: dict[str, Any]) -> dict[str, Any]:
    confidence = requested_suggestion.get("confidence")
    if isinstance(confidence, bool):
        return {}
    if isinstance(confidence, (int, float)) and 0 <= float(confidence) <= 1:
        return {"confidence": float(confidence)}
    return {}


def _fact_entry(*, fact_id: str, value: Any) -> dict[str, Any]:
    field, label = _FACT_METADATA[fact_id]
    if fact_id == "fact.amount_cents" and isinstance(value, int):
        display_value = _format_amount(value)
    elif fact_id == "fact.version" and isinstance(value, int):
        display_value = f"v{value}"
    elif isinstance(value, str):
        display_value = _DISPLAY_VALUE_MAPPINGS.get(fact_id, {}).get(value, value)
    else:
        display_value = str(value)
    return {
        "id": fact_id,
        "field": field,
        "label": label,
        "value": value,
        "display_value": display_value,
        "source": f"order_review_orders.{field}",
    }


def _require_contract_item(name: str, item: Any) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise EvidenceUnavailable(f"{name} metadata must be a mapping")
    return item


def _validate_contract(
    *,
    facts: OrderReviewFacts,
    contract: OntologyContract,
) -> tuple[str, str, str, str]:
    object_type = _require_contract_item("object_type", contract.object_type)
    action_type = _require_contract_item("action_type", contract.action_type)

    expected_object_rid = _expected_object_rid(facts.tenant_id)
    expected_action_rid = _expected_action_rid(facts.tenant_id)

    object_rid = object_type.get("rid")
    object_title = object_type.get("title")
    action_rid = action_type.get("rid")
    action_title = action_type.get("title")
    action_on = action_type.get("on")

    if object_rid != expected_object_rid:
        raise EvidenceUnavailable("object type RID does not match the tenant-scoped order model")
    if not isinstance(object_title, str) or not object_title.strip():
        raise EvidenceUnavailable("object title is required")
    object_title = object_title.strip()
    if object_title == object_rid:
        raise EvidenceUnavailable("object title must be a business label, not the object RID")
    if action_rid != expected_action_rid:
        raise EvidenceUnavailable(
            "action type RID does not match the tenant-scoped order review action"
        )
    if not isinstance(action_title, str) or not action_title.strip():
        raise EvidenceUnavailable("action title is required")
    action_title = action_title.strip()
    if action_title == action_rid:
        raise EvidenceUnavailable("action title must be a business label, not the action RID")
    if not isinstance(action_on, list) or expected_object_rid not in action_on:
        raise EvidenceUnavailable("action must be scoped to the order object type RID")

    return expected_object_rid, expected_action_rid, object_title, action_title


class OrderReviewEvidenceBuilder:
    """Build a deterministic order-review evidence bundle from validated inputs."""

    def build(
        self,
        *,
        facts: OrderReviewFacts,
        contract: OntologyContract,
        requested_suggestion: dict[str, Any],
        now: datetime,
    ) -> dict[str, Any]:
        object_rid, action_rid, object_title, action_title = _validate_contract(
            facts=facts, contract=contract
        )

        threshold_passed = facts.amount_cents >= _THRESHOLD_CENTS
        unpaid_passed = facts.payment_status == "unpaid"
        eligible_passed = threshold_passed and unpaid_passed

        if not eligible_passed:
            raise EvidenceUnavailable("order review evidence is unavailable for the supplied facts")

        derivation = [
            {
                "id": "threshold",
                "label": "订单金额 ≥ ¥1,000.00",
                "passed": threshold_passed,
                "fact_refs": ["fact.amount_cents"],
                "details": {"operator": ">=", "expected_cents": _THRESHOLD_CENTS},
            },
            {
                "id": "unpaid",
                "label": "支付状态 = 未支付",
                "passed": unpaid_passed,
                "fact_refs": ["fact.payment_status"],
                "details": {"operator": "=", "expected": "unpaid"},
            },
            {
                "id": "eligible",
                "label": "满足订单复核条件",
                "passed": eligible_passed,
                "fact_refs": ["threshold", "unpaid"],
            },
        ]

        recommendation: dict[str, Any] = {
            "action": _FOLLOW_UP_ACTION,
            "title": _FOLLOW_UP_TITLE,
            "reason": (
                f"订单金额 {_format_amount(facts.amount_cents)} 且当前未支付，"
                "建议人工确认后创建回款跟进单。"
            ),
            "requires_confirmation": True,
            "derivation_refs": ["eligible"],
            "source_refs": [
                f"ontology://object-type/{object_rid}",
                f"ontology://action-type/{action_rid}",
                _FOLLOW_UP_POLICY_REF,
            ],
        }
        recommendation.update(_confidence_metadata(requested_suggestion))

        return {
            "schema_version": EVIDENCE_SCHEMA_VERSION,
            "status": "complete",
            "ontology": {
                "source": "ontology_kernel",
                "model_rid": object_rid,
                "action_rid": action_rid,
                "graph": {
                    "nodes": [
                        {
                            "id": f"order-fact-anchor:{facts.order_id}",
                            "type": "transaction_anchor",
                            "label": f"订单 {facts.order_id}",
                            "properties": {
                                "order_id": facts.order_id,
                                "source": "order_review_orders",
                                "version": facts.version,
                            },
                        },
                        {
                            "id": f"object-type:{object_rid}",
                            "type": "object_type",
                            "label": object_title,
                            "properties": {"rid": object_rid, "version": "v1"},
                        },
                        {
                            "id": f"action-type:{action_rid}",
                            "type": "action_type",
                            "label": action_title,
                            "properties": {
                                "rid": action_rid,
                                "action_type": "order_review_confirm",
                            },
                        },
                    ],
                    "edges": [
                        {
                            "id": "order-instance-of-model",
                            "source": f"order-fact-anchor:{facts.order_id}",
                            "target": f"object-type:{object_rid}",
                            "label": "符合对象模型",
                        },
                        {
                            "id": "model-supports-action",
                            "source": f"object-type:{object_rid}",
                            "target": f"action-type:{action_rid}",
                            "label": "支持动作",
                        },
                    ],
                },
                "legend": dict(_ONTOLOGY_LEGEND),
            },
            "data": {
                "source": "order_review_orders",
                "captured_at": now.isoformat(),
                "facts": [
                    _fact_entry(fact_id="fact.amount_cents", value=facts.amount_cents),
                    _fact_entry(fact_id="fact.payment_status", value=facts.payment_status),
                    _fact_entry(fact_id="fact.review_status", value=facts.review_status),
                    _fact_entry(fact_id="fact.version", value=facts.version),
                ],
            },
            "derivation": derivation,
            "recommendation": recommendation,
        }
