from __future__ import annotations

from datetime import UTC, datetime

import pytest
from mate_tech_orchestrator.order_review.evidence import (
    EVIDENCE_SCHEMA_VERSION,
    EvidenceUnavailable,
    OntologyContract,
    OrderReviewEvidenceBuilder,
    OrderReviewFacts,
)

TENANT_ID = "tenant-default"
ORDER_ID = "order-1001"
OBJECT_RID = f"ont.{TENANT_ID}.obj.crm.order.v1"
ACTION_RID = f"ont.{TENANT_ID}.act.order-review-confirm.v1"


def _facts(
    *,
    amount_cents: int = 250_000,
    payment_status: str = "unpaid",
    review_status: str = "pending",
    version: int = 1,
    tenant_id: str = TENANT_ID,
    updated_at: datetime | None = None,
) -> OrderReviewFacts:
    return OrderReviewFacts(
        tenant_id=tenant_id,
        order_id=ORDER_ID,
        amount_cents=amount_cents,
        payment_status=payment_status,
        review_status=review_status,
        version=version,
        updated_at=updated_at or datetime(2026, 8, 26, 12, 0, tzinfo=UTC),
    )


def _contract(
    *,
    tenant_id: str = TENANT_ID,
    object_rid: str | None = None,
    action_rid: str | None = None,
    action_title: str = "创建回款跟进单",
    action_on: list[str] | None = None,
) -> OntologyContract:
    object_rid = object_rid or f"ont.{tenant_id}.obj.crm.order.v1"
    action_rid = action_rid or f"ont.{tenant_id}.act.order-review-confirm.v1"
    return OntologyContract(
        object_type={
            "rid": object_rid,
            "title": "订单",
        },
        action_type={
            "rid": action_rid,
            "title": action_title,
            "on": action_on or [object_rid],
        },
    )


def test_build_creates_complete_bundle_for_tenant_default_order() -> None:
    builder = OrderReviewEvidenceBuilder()
    now = datetime(2026, 8, 26, 12, 30, tzinfo=UTC)

    bundle = builder.build(
        facts=_facts(),
        contract=_contract(),
        requested_suggestion={},
        now=now,
    )

    assert bundle["schema_version"] == EVIDENCE_SCHEMA_VERSION
    assert bundle["status"] == "complete"
    assert {node["type"] for node in bundle["ontology"]["graph"]["nodes"]} == {
        "transaction_anchor",
        "object_type",
        "action_type",
    }
    assert {edge["label"] for edge in bundle["ontology"]["graph"]["edges"]} == {
        "符合对象模型",
        "支持动作",
    }
    assert {fact["id"] for fact in bundle["data"]["facts"]} == {
        "fact.amount_cents",
        "fact.payment_status",
        "fact.review_status",
        "fact.version",
    }
    assert all(item["passed"] for item in bundle["derivation"])
    assert bundle["recommendation"]["action"] == "follow_up_payment"
    assert bundle["recommendation"]["title"] == "创建回款跟进单"
    assert {fact["id"]: fact["value"] for fact in bundle["data"]["facts"]}[
        "fact.payment_status"
    ] == "unpaid"
    assert {fact["id"]: fact["display_value"] for fact in bundle["data"]["facts"]}[
        "fact.payment_status"
    ] == "未支付"
    assert {fact["id"]: fact["display_value"] for fact in bundle["data"]["facts"]}[
        "fact.amount_cents"
    ] == "¥2,500.00"
    assert "¥2,500.00" in bundle["recommendation"]["reason"]
    assert "not a persisted Ontology Individual" in bundle["ontology"]["legend"]
    assert bundle["data"]["snapshot"]["updated_at"] == _facts().updated_at.isoformat()
    assert bundle["derivation"][-1]["refs"] == ["threshold", "unpaid"]


@pytest.mark.parametrize(
    ("amount_cents", "should_pass"),
    [
        (99_999, False),
        (100_000, True),
        (100_001, True),
    ],
)
def test_amount_threshold_is_inclusive(amount_cents: int, should_pass: bool) -> None:
    builder = OrderReviewEvidenceBuilder()

    if should_pass:
        bundle = builder.build(
            facts=_facts(amount_cents=amount_cents),
            contract=_contract(),
            requested_suggestion={},
            now=datetime(2026, 8, 26, 12, 30, tzinfo=UTC),
        )
        assert bundle["recommendation"]["action"] == "follow_up_payment"
        assert bundle["status"] == "complete"
        return

    with pytest.raises(EvidenceUnavailable):
        builder.build(
            facts=_facts(amount_cents=amount_cents),
            contract=_contract(),
            requested_suggestion={},
            now=datetime(2026, 8, 26, 12, 30, tzinfo=UTC),
        )


@pytest.mark.parametrize(
    ("payment_status", "review_status", "should_pass"),
    [
        ("unpaid", "pending", True),
        ("paid", "pending", False),
        ("unpaid", "approved", True),
        ("paid", "approved", False),
    ],
)
def test_payment_and_review_state_gate_eligibility(
    payment_status: str,
    review_status: str,
    should_pass: bool,
) -> None:
    builder = OrderReviewEvidenceBuilder()

    if should_pass:
        bundle = builder.build(
            facts=_facts(payment_status=payment_status, review_status=review_status),
            contract=_contract(),
            requested_suggestion={},
            now=datetime(2026, 8, 26, 12, 30, tzinfo=UTC),
        )
        assert bundle["recommendation"]["action"] == "follow_up_payment"
        return

    with pytest.raises(EvidenceUnavailable):
        builder.build(
            facts=_facts(payment_status=payment_status, review_status=review_status),
            contract=_contract(),
            requested_suggestion={},
            now=datetime(2026, 8, 26, 12, 30, tzinfo=UTC),
        )


def test_action_contract_can_bind_additional_rids_when_it_includes_canonical_rid() -> None:
    builder = OrderReviewEvidenceBuilder()

    bundle = builder.build(
        facts=_facts(),
        contract=_contract(action_on=[OBJECT_RID, "ont.tenant-default.obj.crm.invoice.v1"]),
        requested_suggestion={},
        now=datetime(2026, 8, 26, 12, 30, tzinfo=UTC),
    )

    assert bundle["recommendation"]["action"] == "follow_up_payment"


@pytest.mark.parametrize(
    "contract",
    [
        _contract(object_rid="ont.other-tenant.obj.crm.order.v1"),
        _contract(action_rid="ont.other-tenant.act.order-review-confirm.v1"),
        _contract(action_on=["ont.other-tenant.obj.crm.order.v1"]),
        _contract(action_title=""),
    ],
)
def test_builder_rejects_mismatched_contract_metadata(contract: OntologyContract) -> None:
    builder = OrderReviewEvidenceBuilder()

    with pytest.raises(EvidenceUnavailable):
        builder.build(
            facts=_facts(),
            contract=contract,
            requested_suggestion={},
            now=datetime(2026, 8, 26, 12, 30, tzinfo=UTC),
        )


def test_version_seven_snapshot_is_preserved() -> None:
    builder = OrderReviewEvidenceBuilder()
    updated_at = datetime(2026, 8, 25, 23, 45, tzinfo=UTC)

    bundle = builder.build(
        facts=_facts(
            version=7, review_status="approved", payment_status="unpaid", updated_at=updated_at
        ),
        contract=_contract(),
        requested_suggestion={"action": "something-else", "confidence": 0.42},
        now=datetime(2026, 8, 26, 12, 30, tzinfo=UTC),
    )

    assert {fact["id"]: fact["value"] for fact in bundle["data"]["facts"]}["fact.version"] == 7
    assert bundle["recommendation"]["action"] == "follow_up_payment"
    assert bundle["recommendation"]["confidence"] == 0.42
    assert bundle["data"]["snapshot"]["updated_at"] == updated_at.isoformat()
