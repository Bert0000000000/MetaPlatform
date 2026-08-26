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
    object_title: str = "订单",
    action_rid: str | None = None,
    action_title: str = "订单复核确认",
    action_on: list[str] | None = None,
) -> OntologyContract:
    object_rid = object_rid or f"ont.{tenant_id}.obj.crm.order.v1"
    action_rid = action_rid or f"ont.{tenant_id}.act.order-review-confirm.v1"
    return OntologyContract(
        object_type={
            "rid": object_rid,
            "title": object_title,
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
    assert bundle["ontology"] == {
        "source": "ontology_kernel",
        "model_rid": OBJECT_RID,
        "action_rid": ACTION_RID,
        "graph": {
            "nodes": [
                {
                    "id": f"order-fact-anchor:{ORDER_ID}",
                    "label": f"订单 {ORDER_ID}",
                    "type": "transaction_anchor",
                    "properties": {
                        "order_id": ORDER_ID,
                        "source": "order_review_orders",
                        "version": 1,
                    },
                },
                {
                    "id": f"object-type:{OBJECT_RID}",
                    "label": "订单",
                    "type": "object_type",
                    "properties": {"rid": OBJECT_RID, "version": "v1"},
                },
                {
                    "id": f"action-type:{ACTION_RID}",
                    "label": "订单复核确认",
                    "type": "action_type",
                    "properties": {
                        "rid": ACTION_RID,
                        "action_type": "order_review_confirm",
                    },
                },
            ],
            "edges": [
                {
                    "id": "order-instance-of-model",
                    "source": f"order-fact-anchor:{ORDER_ID}",
                    "target": f"object-type:{OBJECT_RID}",
                    "label": "符合对象模型",
                },
                {
                    "id": "model-supports-action",
                    "source": f"object-type:{OBJECT_RID}",
                    "target": f"action-type:{ACTION_RID}",
                    "label": "支持动作",
                },
            ],
        },
        "legend": {
            "transaction_anchor": "订单交易事实的语义锚点，不是已持久化的 Ontology Individual",
            "object_type": "来自 Ontology Kernel 的正式对象模型",
            "action_type": "来自 Ontology Kernel 的订单复核动作定义",
        },
    }
    assert bundle["data"] == {
        "source": "order_review_orders",
        "captured_at": now.isoformat(),
        "facts": [
            {
                "id": "fact.amount_cents",
                "field": "amount_cents",
                "label": "订单金额",
                "value": 250_000,
                "display_value": "¥2,500.00",
                "source": "order_review_orders.amount_cents",
            },
            {
                "id": "fact.payment_status",
                "field": "payment_status",
                "label": "支付状态",
                "value": "unpaid",
                "display_value": "未支付",
                "source": "order_review_orders.payment_status",
            },
            {
                "id": "fact.review_status",
                "field": "review_status",
                "label": "复核状态",
                "value": "pending",
                "display_value": "待复核",
                "source": "order_review_orders.review_status",
            },
            {
                "id": "fact.version",
                "field": "version",
                "label": "订单版本",
                "value": 1,
                "display_value": "v1",
                "source": "order_review_orders.version",
            },
        ],
    }
    assert bundle["derivation"] == [
        {
            "id": "threshold",
            "label": "订单金额 ≥ ¥1,000.00",
            "passed": True,
            "fact_refs": ["fact.amount_cents"],
            "details": {"operator": ">=", "expected_cents": 100_000},
        },
        {
            "id": "unpaid",
            "label": "支付状态 = 未支付",
            "passed": True,
            "fact_refs": ["fact.payment_status"],
            "details": {"operator": "=", "expected": "unpaid"},
        },
        {
            "id": "eligible",
            "label": "满足订单复核条件",
            "passed": True,
            "fact_refs": ["threshold", "unpaid"],
        },
    ]
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
    assert "contract" not in bundle["ontology"]
    assert "snapshot" not in bundle["data"]
    assert all("from" not in edge and "to" not in edge for edge in bundle["ontology"]["graph"]["edges"])
    assert all("refs" not in item for item in bundle["derivation"])


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


def test_custom_threshold_controls_eligibility_and_derivation_without_changing_amount_fact() -> None:
    builder = OrderReviewEvidenceBuilder(threshold_cents=200_000)
    now = datetime(2026, 8, 26, 12, 30, tzinfo=UTC)

    with pytest.raises(EvidenceUnavailable):
        builder.build(
            facts=_facts(amount_cents=199_999),
            contract=_contract(),
            requested_suggestion={},
            now=now,
        )

    bundle = builder.build(
        facts=_facts(amount_cents=200_000),
        contract=_contract(),
        requested_suggestion={},
        now=now,
    )

    threshold = next(item for item in bundle["derivation"] if item["id"] == "threshold")
    amount_fact = next(item for item in bundle["data"]["facts"] if item["id"] == "fact.amount_cents")
    assert threshold == {
        "id": "threshold",
        "label": "订单金额 ≥ ¥2,000.00",
        "passed": True,
        "fact_refs": ["fact.amount_cents"],
        "details": {"operator": ">=", "expected_cents": 200_000},
    }
    assert amount_fact["value"] == 200_000
    assert amount_fact["display_value"] == "¥2,000.00"


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
        _contract(object_title=OBJECT_RID),
        _contract(action_title=ACTION_RID),
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
    assert {fact["id"]: fact["display_value"] for fact in bundle["data"]["facts"]}[
        "fact.version"
    ] == "v7"
    assert {fact["id"]: fact["display_value"] for fact in bundle["data"]["facts"]}[
        "fact.review_status"
    ] == "已批准"
    assert bundle["recommendation"]["action"] == "follow_up_payment"
    assert bundle["recommendation"]["confidence"] == 0.42
    assert bundle["ontology"]["graph"]["nodes"][0]["properties"]["version"] == 7
