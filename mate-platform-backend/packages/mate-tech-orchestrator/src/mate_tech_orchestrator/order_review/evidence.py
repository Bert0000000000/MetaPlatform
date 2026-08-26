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


def _copy_contract_item(item: dict[str, Any]) -> dict[str, Any]:
    return dict(item)


def _confidence_metadata(requested_suggestion: dict[str, Any]) -> dict[str, Any]:
    confidence = requested_suggestion.get("confidence")
    if isinstance(confidence, bool):
        return {}
    if isinstance(confidence, (int, float)) and 0 <= float(confidence) <= 1:
        return {"confidence": float(confidence)}
    return {}


def _fact_entry(*, fact_id: str, value: Any) -> dict[str, Any]:
    if isinstance(value, int):
        display_value = _format_amount(value) if fact_id == "fact.amount_cents" else str(value)
    elif isinstance(value, str):
        display_value = _DISPLAY_VALUE_MAPPINGS.get(fact_id, {}).get(value, value)
    else:
        display_value = str(value)
    return {
        "id": fact_id,
        "value": value,
        "display_value": display_value,
        "source": "database",
    }


def _require_contract_item(name: str, item: Any) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise EvidenceUnavailable(f"{name} metadata must be a mapping")
    return item


def _validate_contract(
    *,
    facts: OrderReviewFacts,
    contract: OntologyContract,
) -> tuple[str, str]:
    object_type = _require_contract_item("object_type", contract.object_type)
    action_type = _require_contract_item("action_type", contract.action_type)

    expected_object_rid = _expected_object_rid(facts.tenant_id)
    expected_action_rid = _expected_action_rid(facts.tenant_id)

    object_rid = object_type.get("rid")
    action_rid = action_type.get("rid")
    action_title = action_type.get("title")
    action_on = action_type.get("on")

    if object_rid != expected_object_rid:
        raise EvidenceUnavailable("object type RID does not match the tenant-scoped order model")
    if action_rid != expected_action_rid:
        raise EvidenceUnavailable(
            "action type RID does not match the tenant-scoped order review action"
        )
    if not isinstance(action_title, str) or not action_title.strip():
        raise EvidenceUnavailable("action title is required")
    if not isinstance(action_on, list) or expected_object_rid not in action_on:
        raise EvidenceUnavailable("action must be scoped to the order object type RID")

    return expected_object_rid, expected_action_rid


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
        object_rid, action_rid = _validate_contract(facts=facts, contract=contract)

        threshold_passed = facts.amount_cents >= _THRESHOLD_CENTS
        unpaid_passed = facts.payment_status == "unpaid"
        eligible_passed = threshold_passed and unpaid_passed

        if not eligible_passed:
            raise EvidenceUnavailable("order review evidence is unavailable for the supplied facts")

        derivation = [
            {
                "id": "threshold",
                "passed": threshold_passed,
                "refs": ["fact.amount_cents"],
            },
            {
                "id": "unpaid",
                "passed": unpaid_passed,
                "refs": ["fact.payment_status"],
            },
            {
                "id": "eligible",
                "passed": eligible_passed,
                "refs": ["threshold", "unpaid"],
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
                "graph": {
                    "nodes": [
                        {
                            "id": f"order-fact-anchor:{facts.order_id}",
                            "type": "transaction_anchor",
                            "label": facts.order_id,
                        },
                        {
                            "id": f"object-type:{object_rid}",
                            "type": "object_type",
                            "label": object_rid,
                            "rid": object_rid,
                        },
                        {
                            "id": f"action-type:{action_rid}",
                            "type": "action_type",
                            "label": action_rid,
                            "rid": action_rid,
                        },
                    ],
                    "edges": [
                        {
                            "id": "order-instance-of-model",
                            "from": f"order-fact-anchor:{facts.order_id}",
                            "to": f"object-type:{object_rid}",
                            "label": "符合对象模型",
                        },
                        {
                            "id": "model-supports-action",
                            "from": f"object-type:{object_rid}",
                            "to": f"action-type:{action_rid}",
                            "label": "支持动作",
                        },
                    ],
                },
                "legend": "The transaction_anchor is not a persisted Ontology Individual.",
                "contract": {
                    "object_type": _copy_contract_item(contract.object_type),
                    "action_type": _copy_contract_item(contract.action_type),
                },
            },
            "data": {
                "facts": [
                    _fact_entry(fact_id="fact.amount_cents", value=facts.amount_cents),
                    _fact_entry(fact_id="fact.payment_status", value=facts.payment_status),
                    _fact_entry(fact_id="fact.review_status", value=facts.review_status),
                    _fact_entry(fact_id="fact.version", value=facts.version),
                ],
                "snapshot": {
                    "tenant_id": facts.tenant_id,
                    "order_id": facts.order_id,
                    "updated_at": facts.updated_at.isoformat(),
                },
            },
            "derivation": derivation,
            "recommendation": recommendation,
        }
