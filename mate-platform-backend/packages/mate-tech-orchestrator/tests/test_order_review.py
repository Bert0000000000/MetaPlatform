"""Transactional order-review vertical slice tests.

These tests deliberately exercise the write path against the SQLAlchemy
repository instead of the in-memory plan runner.  The path is the smallest
useful production contract for the v1.0 north-star journey:

    unpaid order -> review proposal -> human confirmation -> follow-up/outbox
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient
from mate_tech_orchestrator.api import order_review as order_review_api
from mate_tech_orchestrator.api.order_review import OrderReviewService
from mate_tech_orchestrator.api.order_review import public_router as order_review_public_router
from mate_tech_orchestrator.main import create_app
from mate_tech_orchestrator.order_review import OntologyContract
from mate_tech_orchestrator.repositories.order_review import (
    ActionProposalORM,
    IdempotencyRecordORM,
    ReviewCaseORM,
    _iso,
)
from sqlalchemy import event, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from mate_tech_db.base import create_all, get_session, init_engine, reset_engine


@pytest.fixture(autouse=True)
def _sqlite(tmp_path: Path) -> Iterator[None]:  # pyright: ignore[reportUnusedFunction]
    reset_engine()
    init_engine(f"sqlite:///{tmp_path / 'order-review.db'}")
    create_all()
    yield
    reset_engine()


@pytest.fixture
def service() -> OrderReviewService:
    return OrderReviewService(ontology_catalog=_FakeOntologyCatalog())


TEST_AUTH_TOKEN = "test-auth-token"  # noqa: S105 - test token only


def test_iso_normalizes_aware_datetimes_to_utc() -> None:
    captured_at = datetime(2026, 8, 26, 12, 30, tzinfo=timezone(timedelta(hours=8)))

    assert _iso(captured_at) == "2026-08-26T04:30:00+00:00"


def test_iso_preserves_sqlite_naive_datetime_as_utc() -> None:
    captured_at = datetime(2026, 8, 26, 4, 30)

    assert _iso(captured_at) == "2026-08-26T04:30:00+00:00"


class _FakeOntologyCatalog:
    def __init__(self, *, should_fail: bool = False) -> None:
        self.should_fail = should_fail
        self.calls: list[dict[str, str]] = []

    def get_contract(self, *, tenant_id: str, token: str) -> OntologyContract:
        self.calls.append({"tenant_id": tenant_id, "token": token})
        if self.should_fail:
            raise OrderReviewService.EvidenceUnavailable("tech-ont unavailable")
        object_rid = f"ont.{tenant_id}.obj.crm.order.v1"
        action_rid = f"ont.{tenant_id}.act.order-review-confirm.v1"
        return OntologyContract(
            object_type={"rid": object_rid, "title": "订单"},
            action_type={"rid": action_rid, "title": "订单复核确认", "on": [object_rid]},
        )

    def close(self) -> None:
        return None


def _seed_proposal(
    service: OrderReviewService,
    *,
    tenant_id: str = "tenant-acme",
    suggestion: dict[str, Any] | None = None,
) -> str:
    service.create_order(
        tenant_id=tenant_id,
        order_id="order-1001",
        amount_cents=129900,
        payment_status="unpaid",
    )
    result = service.create_review_case(
        tenant_id=tenant_id,
        order_id="order-1001",
        suggestion=suggestion
        if suggestion is not None
        else {"action": "follow_up_payment", "reason": "high value unpaid"},
        source_refs=["ontology://Order/order-1001", "rag://payment-policy/2026-01"],
        auth_token=TEST_AUTH_TOKEN,
    )
    return str(result["proposal_id"])


def _set_persisted_evidence_value(
    proposal_id: str,
    path: tuple[str | int, ...],
    value: Any,
) -> None:
    with get_session() as session, session.begin():
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        case = session.get(ReviewCaseORM, ("tenant-acme", proposal.review_case_id))
        assert case is not None
        suggestion = json.loads(case.suggestion)
        evidence = suggestion["evidence_bundle"]
        if path[0] == "transaction_anchor":
            target = next(
                node
                for node in evidence["ontology"]["graph"]["nodes"]
                if node["type"] == "transaction_anchor"
            )["properties"]
            nested_path = path[1:]
        else:
            target = evidence
            nested_path = path
        for key in nested_path[:-1]:
            target = target[key]
        target[nested_path[-1]] = value
        case.suggestion = json.dumps(suggestion, ensure_ascii=False, sort_keys=True)


def _literal_values(schema: dict[str, object]) -> list[object]:
    if "enum" in schema:
        values = schema["enum"]
        assert isinstance(values, list)
        return values
    if "const" in schema:
        return [schema["const"]]
    raise AssertionError(f"schema does not declare literal values: {schema!r}")


def _assert_datetime_schema(schema: dict[str, object]) -> None:
    if schema.get("type") == "string":
        assert schema["format"] == "date-time"
        return
    if "anyOf" in schema:
        variants = schema["anyOf"]
        assert isinstance(variants, list)
        string_variants = [
            variant
            for variant in variants
            if isinstance(variant, dict) and variant.get("type") == "string"
        ]
        assert len(string_variants) == 1
        assert string_variants[0]["format"] == "date-time"
        return
    raise AssertionError(f"schema does not declare a date-time string: {schema!r}")


def test_confirm_atomically_updates_order_creates_follow_up_and_outbox(service: OrderReviewService):
    proposal_id = _seed_proposal(service)

    result = service.confirm_proposal(
        tenant_id="tenant-acme",
        proposal_id=proposal_id,
        idempotency_key="confirm-order-1001-v1",
        actor_id="u-reviewer",
    )

    assert result["status"] == "confirmed"
    assert result["follow_up_task_id"]
    order = service.get_order(tenant_id="tenant-acme", order_id="order-1001")
    assert order["review_status"] == "approved"
    assert order["version"] == 2
    tasks = service.list_follow_up_tasks(tenant_id="tenant-acme")
    assert len(tasks) == 1
    events = service.list_outbox_events(tenant_id="tenant-acme")
    assert {event["event_type"] for event in events} == {
        "order.review.proposal_created",
        "order.review.confirmed",
        "audit.action_proposal.confirmed",
    }
    proposal_created = next(
        event for event in events if event["event_type"] == "order.review.proposal_created"
    )
    confirmed = next(event for event in events if event["event_type"] == "order.review.confirmed")
    audit_confirmed = next(
        event for event in events if event["event_type"] == "audit.action_proposal.confirmed"
    )
    expected_fact_ids = [
        "fact.amount_cents",
        "fact.payment_status",
        "fact.review_status",
        "fact.version",
    ]
    expected_graph_node_ids = [
        "order-fact-anchor:order-1001",
        "object-type:ont.tenant-acme.obj.crm.order.v1",
        "action-type:ont.tenant-acme.act.order-review-confirm.v1",
    ]
    for emitted_event in (proposal_created, confirmed, audit_confirmed):
        assert emitted_event["payload"]["evidence_schema_version"] == "order-review-evidence.v1"
        assert emitted_event["payload"]["fact_ids"] == expected_fact_ids
        assert emitted_event["payload"]["graph_node_ids"] == expected_graph_node_ids
        assert emitted_event["payload"]["order_version"] == 1
        assert emitted_event["payload"]["proposal_id"] == proposal_id
    assert result["order_version"] == 2
    assert confirmed["payload"]["result_order_version"] == 2
    assert audit_confirmed["payload"]["result_order_version"] == 2
    assert "ontology" not in proposal_created["payload"]
    assert "graph" not in confirmed["payload"]


def test_duplicate_confirmation_is_idempotent_and_does_not_duplicate_side_effects(
    service: OrderReviewService,
):
    proposal_id = _seed_proposal(service)
    first = service.confirm_proposal(
        tenant_id="tenant-acme",
        proposal_id=proposal_id,
        idempotency_key="confirm-repeatable",
        actor_id="u-reviewer",
    )
    second = service.confirm_proposal(
        tenant_id="tenant-acme",
        proposal_id=proposal_id,
        idempotency_key="confirm-repeatable",
        actor_id="u-reviewer",
    )

    assert second == first
    assert len(service.list_follow_up_tasks(tenant_id="tenant-acme")) == 1
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 3


@pytest.mark.parametrize("operation", ["confirm", "reject"])
def test_resolution_locks_tenant_scoped_proposal_before_idempotency_check(
    service: OrderReviewService,
    operation: str,
) -> None:
    proposal_id = _seed_proposal(service)
    statements: list[str] = []

    def capture_statement(orm_execute_state: Any) -> None:
        if orm_execute_state.is_select:
            statements.append(
                str(orm_execute_state.statement.compile(dialect=postgresql.dialect()))
            )

    event.listen(Session, "do_orm_execute", capture_statement)
    try:
        if operation == "confirm":
            service.confirm_proposal(
                tenant_id="tenant-acme",
                proposal_id=proposal_id,
                idempotency_key="lock-before-confirm-idempotency",
                actor_id="u-reviewer",
            )
        else:
            service.reject_proposal(
                tenant_id="tenant-acme",
                proposal_id=proposal_id,
                idempotency_key="lock-before-reject-idempotency",
                actor_id="u-reviewer",
            )
    finally:
        event.remove(Session, "do_orm_execute", capture_statement)

    proposal_lock_index = next(
        index
        for index, statement in enumerate(statements)
        if "FROM order_review_action_proposals" in statement and "FOR UPDATE" in statement
    )
    idempotency_index = next(
        index
        for index, statement in enumerate(statements)
        if "FROM order_review_idempotency_records" in statement
    )
    proposal_lock_statement = statements[proposal_lock_index]
    assert "order_review_action_proposals.tenant_id =" in proposal_lock_statement
    assert "order_review_action_proposals.proposal_id =" in proposal_lock_statement
    assert proposal_lock_index < idempotency_index


def test_expired_confirmation_persists_expired_status_before_conflict(
    service: OrderReviewService,
) -> None:
    proposal_id = _seed_proposal(service)
    with get_session() as session, session.begin():
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        proposal.expires_at = datetime.now(UTC) - timedelta(seconds=1)

    with pytest.raises(OrderReviewService.Conflict, match="action proposal expired"):
        service.confirm_proposal(
            tenant_id="tenant-acme",
            proposal_id=proposal_id,
            idempotency_key="confirm-expired",
            actor_id="u-reviewer",
        )

    proposal = service.get_proposal(tenant_id="tenant-acme", proposal_id=proposal_id)
    assert proposal["status"] == "expired"
    assert proposal["resolved_at"] is not None
    assert service.get_order(tenant_id="tenant-acme", order_id="order-1001")["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []


def test_expired_rejection_persists_expired_status_before_conflict(
    service: OrderReviewService,
) -> None:
    proposal_id = _seed_proposal(service)
    with get_session() as session, session.begin():
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        proposal.expires_at = datetime.now(UTC) - timedelta(seconds=1)

    with pytest.raises(OrderReviewService.Conflict, match="action proposal expired"):
        service.reject_proposal(
            tenant_id="tenant-acme",
            proposal_id=proposal_id,
            idempotency_key="reject-expired",
            actor_id="u-reviewer",
            reason="too late",
        )

    proposal = service.get_proposal(tenant_id="tenant-acme", proposal_id=proposal_id)
    assert proposal["status"] == "expired"
    assert proposal["resolved_at"] is not None
    assert service.get_order(tenant_id="tenant-acme", order_id="order-1001")["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []


def test_approved_order_cannot_create_second_review_case(service: OrderReviewService) -> None:
    proposal_id = _seed_proposal(service)
    service.confirm_proposal(
        tenant_id="tenant-acme",
        proposal_id=proposal_id,
        idempotency_key="confirm-approved-order",
        actor_id="u-reviewer",
    )

    with pytest.raises(OrderReviewService.Conflict, match="order review is not pending"):
        service.create_review_case(
            tenant_id="tenant-acme",
            order_id="order-1001",
            suggestion={"action": "follow_up_payment", "reason": "high value unpaid"},
            source_refs=["ontology://Order/order-1001", "rag://payment-policy/2026-01"],
            auth_token=TEST_AUTH_TOKEN,
        )

    order = service.get_order(tenant_id="tenant-acme", order_id="order-1001")
    assert order["review_status"] == "approved"
    assert order["version"] == 2
    assert len(service.list_follow_up_tasks(tenant_id="tenant-acme")) == 1
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 3
    with get_session() as session:
        assert len(session.execute(select(ReviewCaseORM)).scalars().all()) == 1
        assert len(session.execute(select(ActionProposalORM)).scalars().all()) == 1


def test_stale_order_version_rejects_confirmation_without_side_effects(service: OrderReviewService):
    proposal_id = _seed_proposal(service)
    service.update_order_version(tenant_id="tenant-acme", order_id="order-1001")

    with pytest.raises(OrderReviewService.VersionConflict):
        service.confirm_proposal(
            tenant_id="tenant-acme",
            proposal_id=proposal_id,
            idempotency_key="confirm-stale-version",
            actor_id="u-reviewer",
        )

    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 1
    assert (
        service.get_proposal(tenant_id="tenant-acme", proposal_id=proposal_id)["status"]
        == "pending"
    )


def test_tenant_isolation_prevents_read_and_confirm_acme_proposal(service: OrderReviewService):
    proposal_id = _seed_proposal(service, tenant_id="tenant-acme")

    with pytest.raises(OrderReviewService.NotFound):
        service.get_proposal(tenant_id="tenant-globex", proposal_id=proposal_id)
    with pytest.raises(OrderReviewService.NotFound):
        service.confirm_proposal(
            tenant_id="tenant-globex",
            proposal_id=proposal_id,
            idempotency_key="globex-cannot-confirm",
            actor_id="u-globex",
        )
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []


def test_reject_does_not_change_order_but_records_audit(service: OrderReviewService):
    proposal_id = _seed_proposal(service)
    result = service.reject_proposal(
        tenant_id="tenant-acme",
        proposal_id=proposal_id,
        idempotency_key="reject-order-1001",
        actor_id="u-reviewer",
        reason="customer already contacted",
    )

    assert result["status"] == "rejected"
    assert result["order_id"] == "order-1001"
    assert service.get_order(tenant_id="tenant-acme", order_id="order-1001")["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    events = service.list_outbox_events(tenant_id="tenant-acme")
    assert events[-1]["event_type"] == "audit.action_proposal.rejected"
    assert events[-1]["payload"]["evidence_schema_version"] == "order-review-evidence.v1"
    assert events[-1]["payload"]["fact_ids"] == [
        "fact.amount_cents",
        "fact.payment_status",
        "fact.review_status",
        "fact.version",
    ]
    assert events[-1]["payload"]["graph_node_ids"] == [
        "order-fact-anchor:order-1001",
        "object-type:ont.tenant-acme.obj.crm.order.v1",
        "action-type:ont.tenant-acme.act.order-review-confirm.v1",
    ]
    assert events[-1]["payload"]["order_version"] == 1
    assert events[-1]["payload"]["proposal_id"] == proposal_id
    assert "graph" not in events[-1]["payload"]


@pytest.mark.parametrize("evidence_state", ["missing", "malformed"])
def test_historical_reject_emits_safe_empty_evidence_refs_without_order_side_effects(
    service: OrderReviewService,
    evidence_state: str,
) -> None:
    proposal_id = _seed_proposal(service)
    with get_session() as session, session.begin():
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        case = session.get(ReviewCaseORM, ("tenant-acme", proposal.review_case_id))
        assert case is not None
        suggestion = json.loads(case.suggestion)
        if evidence_state == "missing":
            suggestion.pop("evidence_bundle", None)
        else:
            suggestion["evidence_bundle"] = {
                "schema_version": "forged-evidence.v9",
                "proposal_id": "proposal-forged",
                "order_version": 999,
                "data": {"facts": [{"id": "fact.forged"}]},
                "ontology": {"graph": {"nodes": [{"id": "node-forged"}]}},
            }
        case.suggestion = json.dumps(suggestion, ensure_ascii=False, sort_keys=True)

    result = service.reject_proposal(
        tenant_id="tenant-acme",
        proposal_id=proposal_id,
        idempotency_key=f"reject-historical-{evidence_state}",
        actor_id="u-reviewer",
        reason="historical proposal",
    )

    assert result["status"] == "rejected"
    order = service.get_order(tenant_id="tenant-acme", order_id="order-1001")
    assert order["review_status"] == "pending"
    assert order["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    rejected_event = next(
        event
        for event in service.list_outbox_events(tenant_id="tenant-acme")
        if event["event_type"] == "audit.action_proposal.rejected"
    )
    assert {
        key: rejected_event["payload"][key]
        for key in (
            "evidence_schema_version",
            "fact_ids",
            "graph_node_ids",
            "order_version",
            "proposal_id",
        )
    } == {
        "evidence_schema_version": None,
        "fact_ids": [],
        "graph_node_ids": [],
        "order_version": None,
        "proposal_id": proposal_id,
    }


def test_get_proposal_returns_persisted_evidence_snapshot(service: OrderReviewService) -> None:
    service.create_order(
        tenant_id="tenant-acme",
        order_id="order-1001",
        amount_cents=129900,
        payment_status="unpaid",
    )
    created = service.create_review_case(
        tenant_id="tenant-acme",
        order_id="order-1001",
        suggestion={"action": "follow_up_payment", "reason": "high value unpaid"},
        source_refs=["ontology://Order/order-1001", "rag://payment-policy/2026-01"],
        auth_token=TEST_AUTH_TOKEN,
    )
    proposal_id = str(created["proposal_id"])

    proposal = service.get_proposal(tenant_id="tenant-acme", proposal_id=proposal_id)

    assert created["evidence"]["proposal_id"] == proposal_id
    assert created["evidence"]["order_id"] == "order-1001"
    assert created["evidence"]["tenant_id"] == "tenant-acme"
    assert created["evidence"]["captured_at"]
    assert datetime.fromisoformat(created["evidence"]["captured_at"])
    assert [fact["field"] for fact in created["evidence"]["data"]["facts"]] == [
        "amount_cents",
        "payment_status",
        "review_status",
        "version",
    ]
    assert [fact["label"] for fact in created["evidence"]["data"]["facts"]] == [
        "订单金额",
        "支付状态",
        "复核状态",
        "订单版本",
    ]
    assert proposal["evidence"]["status"] == "complete"
    assert proposal["evidence"]["order_version"] == 1
    assert proposal["evidence"] == created["evidence"]
    assert proposal["suggestion"]["evidence_bundle"] == proposal["evidence"]
    assert proposal["source_refs"] == proposal["evidence"]["recommendation"]["source_refs"]


def test_list_high_value_unpaid_excludes_approved_orders(service: OrderReviewService) -> None:
    service.create_order(
        tenant_id="tenant-acme",
        order_id="order-pending-visible",
        amount_cents=150000,
        payment_status="unpaid",
    )
    service.create_order(
        tenant_id="tenant-acme",
        order_id="order-approved-hidden",
        amount_cents=180000,
        payment_status="unpaid",
    )
    service.create_order(
        tenant_id="tenant-acme",
        order_id="order-paid-hidden",
        amount_cents=220000,
        payment_status="paid",
    )
    service.create_order(
        tenant_id="tenant-globex",
        order_id="order-other-tenant-hidden",
        amount_cents=250000,
        payment_status="unpaid",
    )
    created = service.create_review_case(
        tenant_id="tenant-acme",
        order_id="order-approved-hidden",
        suggestion={"action": "follow_up_payment", "reason": "high value unpaid"},
        source_refs=["ontology://Order/order-approved-hidden"],
        auth_token=TEST_AUTH_TOKEN,
    )
    service.confirm_proposal(
        tenant_id="tenant-acme",
        proposal_id=str(created["proposal_id"]),
        idempotency_key="confirm-approved-hidden",
        actor_id="u-reviewer",
    )

    items = service.list_high_value_unpaid(tenant_id="tenant-acme", min_amount_cents=100000)

    assert [item["order_id"] for item in items] == ["order-pending-visible"]
    assert all(item["payment_status"] == "unpaid" for item in items)
    assert all(item["review_status"] == "pending" for item in items)


def test_custom_threshold_is_shared_by_list_and_evidence() -> None:
    service = OrderReviewService(
        threshold_cents=200_000,
        ontology_catalog=_FakeOntologyCatalog(),
    )
    for order_id, amount_cents in (
        ("order-below-custom-threshold", 199_999),
        ("order-at-custom-threshold", 200_000),
        ("order-above-custom-threshold", 200_001),
    ):
        service.create_order(
            tenant_id="tenant-acme",
            order_id=order_id,
            amount_cents=amount_cents,
            payment_status="unpaid",
        )

    items = service.list_high_value_unpaid(tenant_id="tenant-acme", min_amount_cents=None)

    assert service.threshold_cents == 200_000
    assert [item["order_id"] for item in items] == [
        "order-above-custom-threshold",
        "order-at-custom-threshold",
    ]
    with pytest.raises(OrderReviewService.EvidenceUnavailable):
        service.create_review_case(
            tenant_id="tenant-acme",
            order_id="order-below-custom-threshold",
            suggestion={"action": "follow_up_payment"},
            source_refs=[],
            auth_token=TEST_AUTH_TOKEN,
        )

    created = service.create_review_case(
        tenant_id="tenant-acme",
        order_id="order-at-custom-threshold",
        suggestion={"action": "follow_up_payment"},
        source_refs=[],
        auth_token=TEST_AUTH_TOKEN,
    )
    threshold = next(
        item for item in created["evidence"]["derivation"] if item["id"] == "threshold"
    )
    assert threshold["label"] == "订单金额 ≥ ¥2,000.00"
    assert threshold["details"]["expected_cents"] == 200_000


def test_service_resolves_threshold_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORDER_REVIEW_THRESHOLD_CENTS", "175000")

    service = OrderReviewService(ontology_catalog=_FakeOntologyCatalog())

    assert service.threshold_cents == 175_000


@pytest.mark.parametrize("raw_threshold", ["", "0", "-1", "not-an-integer"])
def test_service_rejects_invalid_threshold_environment(
    monkeypatch: pytest.MonkeyPatch,
    raw_threshold: str,
) -> None:
    monkeypatch.setenv("ORDER_REVIEW_THRESHOLD_CENTS", raw_threshold)

    with pytest.raises(ValueError, match="ORDER_REVIEW_THRESHOLD_CENTS"):
        OrderReviewService(ontology_catalog=_FakeOntologyCatalog())


def test_high_value_unpaid_api_returns_effective_threshold(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
) -> None:
    service = OrderReviewService(
        threshold_cents=175_000,
        ontology_catalog=_FakeOntologyCatalog(),
    )
    monkeypatch.setattr(order_review_api, "_service", service)
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}
    for order_id, amount_cents in (("order-1750", 175_000), ("order-2000", 200_000)):
        response = client.post(
            "/api/v1/orders",
            headers=headers,
            json={"order_id": order_id, "amount_cents": amount_cents},
        )
        assert response.status_code == 201, response.text

    configured = client.get("/api/v1/orders/high-value-unpaid", headers=headers)
    stricter = client.get(
        "/api/v1/orders/high-value-unpaid",
        headers=headers,
        params={"min_amount_cents": 200_000},
    )

    assert configured.status_code == 200, configured.text
    assert configured.json()["threshold_cents"] == 175_000
    assert [item["order_id"] for item in configured.json()["items"]] == [
        "order-2000",
        "order-1750",
    ]
    assert stricter.status_code == 200, stricter.text
    assert stricter.json()["threshold_cents"] == 200_000
    assert [item["order_id"] for item in stricter.json()["items"]] == ["order-2000"]


def test_catalog_failure_does_not_create_case_proposal_or_outbox() -> None:
    service = OrderReviewService(ontology_catalog=_FakeOntologyCatalog(should_fail=True))
    service.create_order(
        tenant_id="tenant-acme",
        order_id="order-1001",
        amount_cents=129900,
        payment_status="unpaid",
    )

    with pytest.raises(OrderReviewService.EvidenceUnavailable):
        service.create_review_case(
            tenant_id="tenant-acme",
            order_id="order-1001",
            suggestion={"action": "follow_up_payment", "reason": "high value unpaid"},
            source_refs=["ontology://Order/order-1001"],
            auth_token=TEST_AUTH_TOKEN,
        )

    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    assert service.list_outbox_events(tenant_id="tenant-acme") == []
    with get_session() as session:
        assert session.execute(select(ReviewCaseORM)).scalars().all() == []


def test_confirmation_requires_persisted_evidence_and_does_not_create_side_effects(
    service: OrderReviewService,
) -> None:
    proposal_id = _seed_proposal(service)

    with get_session() as session, session.begin():
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        case = session.get(ReviewCaseORM, ("tenant-acme", proposal.review_case_id))
        assert case is not None
        suggestion = json.loads(case.suggestion)
        suggestion.pop("evidence_bundle", None)
        case.suggestion = json.dumps(suggestion, ensure_ascii=False, sort_keys=True)

    with pytest.raises(OrderReviewService.EvidenceRequired):
        service.confirm_proposal(
            tenant_id="tenant-acme",
            proposal_id=proposal_id,
            idempotency_key="confirm-missing-evidence",
            actor_id="u-reviewer",
        )

    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 1


@pytest.mark.parametrize(
    ("path", "invalid_value", "expected_error"),
    [
        (("tenant_id",), "tenant-globex", OrderReviewService.EvidenceRequired),
        (("proposal_id",), "proposal-other", OrderReviewService.EvidenceRequired),
        (("order_id",), "order-other", OrderReviewService.EvidenceRequired),
        (("order_version",), 2, OrderReviewService.VersionConflict),
        (("ontology", "source"), "legacy_catalog", OrderReviewService.EvidenceRequired),
        (
            ("ontology", "model_rid"),
            "ont.tenant-globex.obj.crm.order.v1",
            OrderReviewService.EvidenceRequired,
        ),
        (
            ("ontology", "action_rid"),
            "ont.tenant-globex.act.order-review-confirm.v1",
            OrderReviewService.EvidenceRequired,
        ),
        (("transaction_anchor", "order_id"), "order-other", OrderReviewService.EvidenceRequired),
        (("transaction_anchor", "source"), "legacy_orders", OrderReviewService.EvidenceRequired),
        (("transaction_anchor", "version"), 2, OrderReviewService.EvidenceRequired),
        (
            ("recommendation", "action"),
            "cancel_order",
            OrderReviewService.EvidenceRequired,
        ),
        (
            ("recommendation", "requires_confirmation"),
            False,
            OrderReviewService.EvidenceRequired,
        ),
        (("data", "facts", 0, "value"), 1, OrderReviewService.EvidenceRequired),
        (
            ("data", "facts", 1, "source"),
            "order_review_orders.amount_cents",
            OrderReviewService.EvidenceRequired,
        ),
        (
            ("ontology", "graph", "edges", 0, "target"),
            "action-type:ont.tenant-acme.act.order-review-confirm.v1",
            OrderReviewService.EvidenceRequired,
        ),
        (
            ("derivation", 0, "fact_refs"),
            ["fact.payment_status"],
            OrderReviewService.EvidenceRequired,
        ),
        (
            ("derivation", 0, "details", "expected_cents"),
            1,
            OrderReviewService.EvidenceRequired,
        ),
    ],
    ids=[
        "tenant",
        "proposal",
        "order",
        "order-version",
        "ontology-source",
        "model-rid",
        "action-rid",
        "anchor-order",
        "anchor-source",
        "anchor-version",
        "recommendation-action",
        "confirmation-not-allowed",
        "fact-value",
        "fact-source",
        "edge-target",
        "derivation-refs",
        "derivation-details",
    ],
)
def test_confirmation_rejects_mismatched_evidence_without_side_effects(
    service: OrderReviewService,
    path: tuple[str | int, ...],
    invalid_value: Any,
    expected_error: type[Exception],
) -> None:
    proposal_id = _seed_proposal(service)
    _set_persisted_evidence_value(proposal_id, path, invalid_value)

    with pytest.raises(expected_error):
        service.confirm_proposal(
            tenant_id="tenant-acme",
            proposal_id=proposal_id,
            idempotency_key=f"confirm-mismatched-{'-'.join(str(item) for item in path)}",
            actor_id="u-reviewer",
        )

    order = service.get_order(tenant_id="tenant-acme", order_id="order-1001")
    assert order["review_status"] == "pending"
    assert order["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 1
    with get_session() as session:
        assert session.execute(select(IdempotencyRecordORM)).scalars().all() == []
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        assert proposal.status == "pending"


@pytest.mark.parametrize(
    "path",
    [("captured_at",), ("data", "captured_at")],
    ids=["bundle-captured-at", "data-captured-at"],
)
def test_confirmation_rejects_evidence_timestamp_not_equal_to_proposal_creation(
    service: OrderReviewService,
    path: tuple[str, ...],
) -> None:
    proposal_id = _seed_proposal(service)
    _set_persisted_evidence_value(proposal_id, ("captured_at",), "2026-01-01T00:00:00+00:00")
    _set_persisted_evidence_value(
        proposal_id,
        ("data", "captured_at"),
        "2026-01-01T00:00:00+00:00",
    )

    with pytest.raises(OrderReviewService.EvidenceRequired):
        service.confirm_proposal(
            tenant_id="tenant-acme",
            proposal_id=proposal_id,
            idempotency_key=f"confirm-tampered-{path[-1]}",
            actor_id="u-reviewer",
        )

    assert service.get_order(tenant_id="tenant-acme", order_id="order-1001")["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 1
    with get_session() as session:
        assert session.execute(select(IdempotencyRecordORM)).scalars().all() == []


def test_confirmation_rejects_confidence_different_from_original_suggestion(
    service: OrderReviewService,
) -> None:
    proposal_id = _seed_proposal(
        service,
        suggestion={
            "action": "follow_up_payment",
            "reason": "high value unpaid",
            "confidence": 0.42,
        },
    )
    _set_persisted_evidence_value(proposal_id, ("recommendation", "confidence"), 0.43)

    with pytest.raises(OrderReviewService.EvidenceRequired, match="confidence"):
        service.confirm_proposal(
            tenant_id="tenant-acme",
            proposal_id=proposal_id,
            idempotency_key="confirm-tampered-confidence",
            actor_id="u-reviewer",
        )

    assert service.get_order(tenant_id="tenant-acme", order_id="order-1001")["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 1
    with get_session() as session:
        assert session.execute(select(IdempotencyRecordORM)).scalars().all() == []


def test_confirmation_rejects_new_confidence_when_original_suggestion_has_none(
    service: OrderReviewService,
) -> None:
    proposal_id = _seed_proposal(service)
    _set_persisted_evidence_value(proposal_id, ("recommendation", "confidence"), 0.42)

    with pytest.raises(OrderReviewService.EvidenceRequired, match="confidence"):
        service.confirm_proposal(
            tenant_id="tenant-acme",
            proposal_id=proposal_id,
            idempotency_key="confirm-added-confidence",
            actor_id="u-reviewer",
        )

    assert service.get_order(tenant_id="tenant-acme", order_id="order-1001")["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 1
    with get_session() as session:
        assert session.execute(select(IdempotencyRecordORM)).scalars().all() == []


def test_order_review_http_flow_uses_tenant_from_authenticated_context(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
):
    catalog = _FakeOntologyCatalog()
    service = OrderReviewService(ontology_catalog=catalog)
    monkeypatch.setattr(order_review_api, "_service", service)
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}

    order_response = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "order_id": "order-http-1",
            "amount_cents": 188000,
            "payment_status": "unpaid",
        },
    )
    assert order_response.status_code == 201, order_response.text

    case_response = client.post(
        "/api/v1/review-cases",
        headers=headers,
        json={
            "order_id": "order-http-1",
            "suggestion": {"action": "follow_up_payment", "reason": "unpaid"},
            "source_refs": ["ontology://Order/order-http-1"],
        },
    )
    assert case_response.status_code == 201, case_response.text
    case_payload = case_response.json()
    proposal_id = case_payload["proposal_id"]
    expected_token = headers["Authorization"].split(" ", 1)[1]

    assert catalog.calls == [{"tenant_id": "tenant-acme", "token": expected_token}]
    assert case_payload["evidence"]["status"] == "complete"
    assert case_payload["evidence"]["ontology"]["source"] == "ontology_kernel"
    assert case_payload["evidence"]["ontology"]["model_rid"] == ("ont.tenant-acme.obj.crm.order.v1")
    assert case_payload["evidence"]["ontology"]["action_rid"] == (
        "ont.tenant-acme.act.order-review-confirm.v1"
    )
    assert case_payload["evidence"]["ontology"]["graph"]["nodes"]
    assert case_payload["evidence"]["ontology"]["graph"]["edges"]
    assert case_payload["evidence"]["ontology"]["legend"]["object_type"] == (
        "来自 Ontology Kernel 的正式对象模型"
    )
    assert case_payload["evidence"]["data"]["facts"]
    assert case_payload["evidence"]["data"]["source"] == "order_review_orders"
    assert (
        case_payload["evidence"]["data"]["captured_at"] == case_payload["evidence"]["captured_at"]
    )
    assert [fact["source"] for fact in case_payload["evidence"]["data"]["facts"]] == [
        "order_review_orders.amount_cents",
        "order_review_orders.payment_status",
        "order_review_orders.review_status",
        "order_review_orders.version",
    ]
    assert case_payload["evidence"]["derivation"]
    assert case_payload["evidence"]["derivation"][0] == {
        "id": "threshold",
        "label": "订单金额 ≥ ¥1,000.00",
        "passed": True,
        "fact_refs": ["fact.amount_cents"],
        "details": {"operator": ">=", "expected_cents": 100_000},
    }
    assert case_payload["evidence"]["recommendation"]["requires_confirmation"] is True
    assert "contract" not in case_payload["evidence"]["ontology"]
    assert "snapshot" not in case_payload["evidence"]["data"]

    legacy_confirm_response = client.post(
        f"/api/v1/action-proposals/{proposal_id}/confirm",
        headers={**headers, "Idempotency-Key": "legacy-confirm-1"},
        json={"actor_id": "u-reviewer"},
    )
    assert legacy_confirm_response.status_code == 404, legacy_confirm_response.text

    confirm_response = client.post(
        f"/api/v1/action-proposals/{proposal_id}:confirm",
        headers={**headers, "Idempotency-Key": "http-confirm-1"},
        json={"actor_id": "u-reviewer"},
    )
    assert confirm_response.status_code == 200, confirm_response.text
    assert confirm_response.json()["status"] == "confirmed"
    audit_event = next(
        event
        for event in service.list_outbox_events(tenant_id="tenant-acme")
        if event["event_type"] == "audit.action_proposal.confirmed"
    )
    assert audit_event["payload"]["actor_id"] == "u-1"

    detail_response = client.get(
        f"/api/v1/action-proposals/{proposal_id}",
        headers=headers,
    )
    assert detail_response.status_code == 200, detail_response.text
    detail_payload = detail_response.json()
    assert detail_payload["evidence"] == case_payload["evidence"]
    assert detail_payload["evidence"]["status"] == "complete"
    assert detail_payload["evidence"]["ontology"]["graph"]["nodes"]
    assert detail_payload["evidence"]["data"]["facts"]
    assert detail_payload["evidence"]["derivation"]
    assert detail_payload["evidence"]["recommendation"]["source_refs"]

    duplicate_response = client.post(
        f"/api/v1/action-proposals/{proposal_id}:confirm",
        headers={**headers, "Idempotency-Key": "http-confirm-1"},
        json={"actor_id": "u-reviewer"},
    )
    assert duplicate_response.status_code == 200
    assert duplicate_response.json() == confirm_response.json()


def test_reject_http_uses_authenticated_actor_instead_of_body_actor(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
) -> None:
    service = OrderReviewService(ontology_catalog=_FakeOntologyCatalog())
    monkeypatch.setattr(order_review_api, "_service", service)
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}
    assert (
        client.post(
            "/api/v1/orders",
            headers=headers,
            json={
                "order_id": "order-http-reject-actor",
                "amount_cents": 188000,
                "payment_status": "unpaid",
            },
        ).status_code
        == 201
    )
    case_response = client.post(
        "/api/v1/review-cases",
        headers=headers,
        json={
            "order_id": "order-http-reject-actor",
            "suggestion": {"action": "follow_up_payment"},
            "source_refs": [],
        },
    )
    assert case_response.status_code == 201, case_response.text

    reject_response = client.post(
        f"/api/v1/action-proposals/{case_response.json()['proposal_id']}:reject",
        headers={**headers, "Idempotency-Key": "reject-context-actor"},
        json={"actor_id": "spoofed-client-actor", "reason": "manual reject"},
    )

    assert reject_response.status_code == 200, reject_response.text
    audit_event = next(
        event
        for event in service.list_outbox_events(tenant_id="tenant-acme")
        if event["event_type"] == "audit.action_proposal.rejected"
    )
    assert audit_event["payload"]["actor_id"] == "u-1"


def test_create_review_case_http_returns_503_for_evidence_unavailable(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
) -> None:
    monkeypatch.setattr(
        order_review_api,
        "_service",
        OrderReviewService(ontology_catalog=_FakeOntologyCatalog(should_fail=True)),
    )
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}

    order_response = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "order_id": "order-http-503",
            "amount_cents": 188000,
            "payment_status": "unpaid",
        },
    )
    assert order_response.status_code == 201, order_response.text

    case_response = client.post(
        "/api/v1/review-cases",
        headers=headers,
        json={
            "order_id": "order-http-503",
            "suggestion": {"action": "follow_up_payment", "reason": "unpaid"},
            "source_refs": ["ontology://Order/order-http-503"],
        },
    )

    assert case_response.status_code == 503
    assert case_response.headers["x-error-code"] == "evidence_unavailable"
    assert case_response.json()["detail"] == "tech-ont unavailable"


def test_create_review_case_http_returns_503_when_response_evidence_is_invalid(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
) -> None:
    monkeypatch.setattr(
        order_review_api, "_service", OrderReviewService(ontology_catalog=_FakeOntologyCatalog())
    )
    monkeypatch.setattr(order_review_api, "_response_evidence", lambda evidence: None)
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}

    order_response = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "order_id": "order-http-invalid-evidence",
            "amount_cents": 188000,
            "payment_status": "unpaid",
        },
    )
    assert order_response.status_code == 201, order_response.text

    case_response = client.post(
        "/api/v1/review-cases",
        headers=headers,
        json={
            "order_id": "order-http-invalid-evidence",
            "suggestion": {"action": "follow_up_payment", "reason": "unpaid"},
            "source_refs": ["ontology://Order/order-http-invalid-evidence"],
        },
    )

    assert case_response.status_code == 503
    assert case_response.headers["x-error-code"] == "evidence_unavailable"
    assert case_response.json()["detail"] == "order review evidence bundle is missing or invalid"


def test_confirm_http_returns_409_for_missing_persisted_evidence(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
) -> None:
    monkeypatch.setattr(
        order_review_api, "_service", OrderReviewService(ontology_catalog=_FakeOntologyCatalog())
    )
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}

    order_response = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "order_id": "order-http-409",
            "amount_cents": 188000,
            "payment_status": "unpaid",
        },
    )
    assert order_response.status_code == 201, order_response.text

    case_response = client.post(
        "/api/v1/review-cases",
        headers=headers,
        json={
            "order_id": "order-http-409",
            "suggestion": {"action": "follow_up_payment", "reason": "unpaid"},
            "source_refs": ["ontology://Order/order-http-409"],
        },
    )
    assert case_response.status_code == 201, case_response.text
    proposal_id = case_response.json()["proposal_id"]

    with get_session() as session, session.begin():
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        case = session.get(ReviewCaseORM, ("tenant-acme", proposal.review_case_id))
        assert case is not None
        suggestion = json.loads(case.suggestion)
        suggestion.pop("evidence_bundle", None)
        case.suggestion = json.dumps(suggestion, ensure_ascii=False, sort_keys=True)

    confirm_response = client.post(
        f"/api/v1/action-proposals/{proposal_id}:confirm",
        headers={**headers, "Idempotency-Key": "http-confirm-missing-evidence"},
        json={"actor_id": "u-reviewer"},
    )

    assert confirm_response.status_code == 409
    assert confirm_response.headers["x-error-code"] == "evidence_required"
    assert confirm_response.json()["detail"] == "evidence bundle is required before confirmation"


def test_historical_proposal_detail_returns_200_without_evidence_bundle(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
) -> None:
    monkeypatch.setattr(
        order_review_api, "_service", OrderReviewService(ontology_catalog=_FakeOntologyCatalog())
    )
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}

    order_response = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "order_id": "order-http-history",
            "amount_cents": 188000,
            "payment_status": "unpaid",
        },
    )
    assert order_response.status_code == 201, order_response.text

    case_response = client.post(
        "/api/v1/review-cases",
        headers=headers,
        json={
            "order_id": "order-http-history",
            "suggestion": {"action": "follow_up_payment", "reason": "unpaid"},
            "source_refs": ["ontology://Order/order-http-history"],
        },
    )
    assert case_response.status_code == 201, case_response.text
    proposal_id = case_response.json()["proposal_id"]

    with get_session() as session, session.begin():
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        case = session.get(ReviewCaseORM, ("tenant-acme", proposal.review_case_id))
        assert case is not None
        suggestion = json.loads(case.suggestion)
        suggestion.pop("evidence_bundle", None)
        case.suggestion = json.dumps(suggestion, ensure_ascii=False, sort_keys=True)

    detail_response = client.get(
        f"/api/v1/action-proposals/{proposal_id}",
        headers=headers,
    )

    assert detail_response.status_code == 200, detail_response.text
    detail_payload = detail_response.json()
    assert detail_payload["proposal_id"] == proposal_id
    assert detail_payload["suggestion"] == {"action": "follow_up_payment", "reason": "unpaid"}
    assert detail_payload["source_refs"] == [
        "ontology://object-type/ont.tenant-acme.obj.crm.order.v1",
        "ontology://action-type/ont.tenant-acme.act.order-review-confirm.v1",
        "policy://payment-follow-up-policy",
    ]
    assert detail_payload["evidence"] is None


def test_alternate_historical_evidence_returns_detail_and_blocks_confirm_without_side_effects(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
) -> None:
    service = OrderReviewService(ontology_catalog=_FakeOntologyCatalog())
    monkeypatch.setattr(order_review_api, "_service", service)
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}

    assert (
        client.post(
            "/api/v1/orders",
            headers=headers,
            json={
                "order_id": "order-http-incomplete-evidence",
                "amount_cents": 188000,
                "payment_status": "unpaid",
            },
        ).status_code
        == 201
    )
    created_response = client.post(
        "/api/v1/review-cases",
        headers=headers,
        json={
            "order_id": "order-http-incomplete-evidence",
            "suggestion": {"action": "follow_up_payment", "reason": "unpaid"},
            "source_refs": ["ontology://Order/order-http-incomplete-evidence"],
        },
    )
    assert created_response.status_code == 201, created_response.text
    proposal_id = created_response.json()["proposal_id"]

    with get_session() as session, session.begin():
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        case = session.get(ReviewCaseORM, ("tenant-acme", proposal.review_case_id))
        assert case is not None
        suggestion = json.loads(case.suggestion)
        evidence = suggestion["evidence_bundle"]
        evidence["ontology"] = {
            "graph": {
                "nodes": [
                    {
                        "id": "order-fact-anchor:legacy",
                        "type": "transaction_anchor",
                        "label": "legacy",
                    },
                    {
                        "id": "object-type:legacy",
                        "type": "object_type",
                        "label": "ont.legacy.order.v1",
                        "rid": "ont.legacy.order.v1",
                    },
                ],
                "edges": [
                    {
                        "id": "legacy-edge",
                        "from": "order-fact-anchor:legacy",
                        "to": "object-type:legacy",
                        "label": "旧关系",
                    }
                ],
            },
            "legend": "legacy string legend",
            "contract": {
                "object_type": {"rid": "ont.legacy.order.v1", "title": "订单"},
                "action_type": {
                    "rid": "ont.legacy.action.v1",
                    "title": "订单复核确认",
                    "on": ["ont.legacy.order.v1"],
                },
            },
        }
        evidence["data"] = {
            "facts": [
                {
                    "id": "fact.amount_cents",
                    "field": "amount_cents",
                    "label": "订单金额",
                    "value": 188000,
                    "display_value": "¥1,880.00",
                    "source": "database",
                }
            ],
            "snapshot": {
                "tenant_id": "tenant-acme",
                "order_id": "order-http-incomplete-evidence",
                "updated_at": evidence["captured_at"],
            },
        }
        evidence["derivation"] = [
            {"id": "threshold", "passed": True, "refs": ["fact.amount_cents"]}
        ]
        case.suggestion = json.dumps(suggestion, ensure_ascii=False, sort_keys=True)

    before_task_count = len(service.list_follow_up_tasks(tenant_id="tenant-acme"))
    before_outbox_count = len(service.list_outbox_events(tenant_id="tenant-acme"))
    with get_session() as session:
        before_idempotency_count = len(
            session.execute(select(IdempotencyRecordORM)).scalars().all()
        )

    detail_response = client.get(f"/api/v1/action-proposals/{proposal_id}", headers=headers)

    assert detail_response.status_code == 200, detail_response.text
    detail_payload = detail_response.json()
    assert detail_payload["proposal_id"] == proposal_id
    assert detail_payload["suggestion"]["action"] == "follow_up_payment"
    assert detail_payload["source_refs"] == [
        "ontology://object-type/ont.tenant-acme.obj.crm.order.v1",
        "ontology://action-type/ont.tenant-acme.act.order-review-confirm.v1",
        "policy://payment-follow-up-policy",
    ]
    assert detail_payload["evidence"] is None

    confirm_response = client.post(
        f"/api/v1/action-proposals/{proposal_id}:confirm",
        headers={**headers, "Idempotency-Key": "http-confirm-alternate-evidence"},
        json={"actor_id": "u-reviewer"},
    )

    assert confirm_response.status_code == 409
    assert confirm_response.headers["x-error-code"] == "evidence_required"
    assert confirm_response.json()["detail"] == "evidence bundle is required before confirmation"
    assert len(service.list_follow_up_tasks(tenant_id="tenant-acme")) == before_task_count
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == before_outbox_count
    with get_session() as session:
        assert (
            len(session.execute(select(IdempotencyRecordORM)).scalars().all())
            == before_idempotency_count
        )
        proposal = session.get(ActionProposalORM, ("tenant-acme", proposal_id))
        assert proposal is not None
        assert proposal.status == "pending"


def test_order_review_openapi_declares_evidence_contract() -> None:
    client = TestClient(create_app())

    response = client.get("/openapi.json")

    assert response.status_code == 200, response.text
    document = response.json()
    components = document["components"]["schemas"]

    create_response_schema = document["paths"]["/api/v1/review-cases"]["post"]["responses"]["201"][
        "content"
    ]["application/json"]["schema"]
    assert create_response_schema["$ref"] == "#/components/schemas/CreateReviewCaseResponse"
    assert document["paths"]["/api/v1/review-cases"]["post"]["responses"]["503"]["description"]
    assert document["paths"]["/api/v1/action-proposals/{proposal_id}:confirm"]["post"]["responses"][
        "409"
    ]["description"]

    action_proposal_schema = components["ActionProposal"]
    assert action_proposal_schema["required"] == [
        "tenant_id",
        "proposal_id",
        "review_case_id",
        "order_id",
        "action_type",
        "status",
        "expected_order_version",
        "suggestion",
        "source_refs",
        "parameters",
        "expires_at",
        "created_at",
    ]
    assert action_proposal_schema["properties"]["evidence"]["anyOf"] == [
        {"$ref": "#/components/schemas/EvidenceBundle"},
        {"type": "null"},
    ]

    evidence_bundle = components["EvidenceBundle"]
    assert evidence_bundle["required"] == [
        "schema_version",
        "status",
        "proposal_id",
        "order_id",
        "tenant_id",
        "order_version",
        "captured_at",
        "ontology",
        "data",
        "derivation",
        "recommendation",
    ]
    assert _literal_values(evidence_bundle["properties"]["schema_version"]) == [
        "order-review-evidence.v1"
    ]
    assert _literal_values(evidence_bundle["properties"]["status"]) == ["complete", "unavailable"]

    ontology_schema = components["OntologyEvidence"]
    assert ontology_schema["required"] == [
        "source",
        "model_rid",
        "action_rid",
        "graph",
        "legend",
    ]
    assert _literal_values(ontology_schema["properties"]["source"]) == ["ontology_kernel"]
    assert "contract" not in ontology_schema["properties"]

    graph_schema = components["EvidenceGraph"]
    assert graph_schema["required"] == ["nodes", "edges"]
    node_schema = components["EvidenceGraphNode"]
    assert node_schema["required"] == ["id", "label", "type", "properties"]
    assert _literal_values(node_schema["properties"]["type"]) == [
        "transaction_anchor",
        "object_type",
        "action_type",
    ]
    edge_schema = components["EvidenceGraphEdge"]
    assert edge_schema["required"] == ["id", "source", "target", "label"]
    assert "from" not in edge_schema["properties"]
    assert "to" not in edge_schema["properties"]

    legend_schema = components["EvidenceLegend"]
    assert legend_schema["required"] == ["transaction_anchor", "object_type", "action_type"]

    data_schema = components["EvidenceData"]
    assert data_schema["required"] == ["source", "captured_at", "facts"]
    assert _literal_values(data_schema["properties"]["source"]) == ["order_review_orders"]
    assert "snapshot" not in data_schema["properties"]
    fact_schema = components["EvidenceFact"]
    assert fact_schema["required"] == ["id", "field", "label", "value", "display_value", "source"]
    _assert_datetime_schema(data_schema["properties"]["captured_at"])

    derivation_schema = components["EvidenceDerivation"]
    assert derivation_schema["required"] == ["id", "label", "passed", "fact_refs"]
    assert "refs" not in derivation_schema["properties"]

    recommendation_schema = components["EvidenceRecommendation"]
    assert recommendation_schema["required"] == [
        "action",
        "title",
        "reason",
        "requires_confirmation",
        "derivation_refs",
        "source_refs",
    ]
    _assert_datetime_schema(evidence_bundle["properties"]["captured_at"])
    _assert_datetime_schema(action_proposal_schema["properties"]["created_at"])
    _assert_datetime_schema(action_proposal_schema["properties"]["expires_at"])
    _assert_datetime_schema(action_proposal_schema["properties"]["resolved_at"])

    static_document = yaml.safe_load(
        (
            Path(__file__).parents[3] / "contracts" / "openapi" / "services" / "orchestrator.yaml"
        ).read_text(encoding="utf-8")
    )
    static_components = static_document["components"]["schemas"]
    for schema_name in (
        "EvidenceGraphNode",
        "EvidenceGraphEdge",
        "EvidenceLegend",
        "OntologyEvidence",
        "EvidenceFact",
        "EvidenceData",
        "EvidenceDerivation",
        "EvidenceRecommendation",
        "EvidenceBundle",
    ):
        assert static_components[schema_name]["required"] == components[schema_name]["required"]


def test_order_review_openapi_declares_threshold_and_action_result_contract() -> None:
    client = TestClient(create_app())

    response = client.get("/openapi.json")

    assert response.status_code == 200, response.text
    document = response.json()
    components = document["components"]["schemas"]
    list_operation = document["paths"]["/api/v1/orders/high-value-unpaid"]["get"]
    list_parameter = next(
        parameter
        for parameter in list_operation["parameters"]
        if parameter["name"] == "min_amount_cents"
    )
    assert "default" not in list_parameter["schema"]
    list_schema = components["HighValueUnpaidResponse"]
    assert list_schema["required"] == ["items", "total", "threshold_cents"]
    assert list_schema["properties"]["threshold_cents"]["minimum"] == 1
    assert list_operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/HighValueUnpaidResponse"
    }

    action_result_schema = components["ActionResult"]
    assert action_result_schema["required"] == ["proposal_id", "order_id", "status"]
    expected_optional_fields = {
        "order_version": [{"minimum": 1, "type": "integer"}, {"type": "null"}],
        "follow_up_task_id": [{"type": "string"}, {"type": "null"}],
        "reason": [{"type": "string"}, {"type": "null"}],
    }
    for field_name, expected_schema in expected_optional_fields.items():
        assert action_result_schema["properties"][field_name]["anyOf"] == expected_schema
    for path in (
        "/api/v1/action-proposals/{proposal_id}:confirm",
        "/api/v1/action-proposals/{proposal_id}:reject",
    ):
        assert document["paths"][path]["post"]["responses"]["200"]["content"]["application/json"][
            "schema"
        ] == {"$ref": "#/components/schemas/ActionResult"}

    static_document = yaml.safe_load(
        (
            Path(__file__).parents[3] / "contracts" / "openapi" / "services" / "orchestrator.yaml"
        ).read_text(encoding="utf-8")
    )
    static_components = static_document["components"]["schemas"]
    assert static_components["HighValueUnpaidResponse"]["required"] == [
        "items",
        "total",
        "threshold_cents",
    ]
    assert static_components["ActionResult"]["required"] == [
        "proposal_id",
        "order_id",
        "status",
    ]
    for field_name, expected_schema in expected_optional_fields.items():
        assert (
            static_components["ActionResult"]["properties"][field_name]["anyOf"] == expected_schema
        )


@pytest.mark.parametrize("compose_name", ["docker-compose.yml", "docker-compose.task5.yml"])
def test_order_review_threshold_is_deployed_to_orchestrator(compose_name: str) -> None:
    workspace_root = Path(__file__).parents[4]
    compose = yaml.safe_load((workspace_root / compose_name).read_text(encoding="utf-8"))

    assert (
        compose["services"]["mate-tech-orchestrator"]["environment"]["ORDER_REVIEW_THRESHOLD_CENTS"]
        == "${ORDER_REVIEW_THRESHOLD_CENTS:-100000}"
    )


def test_action_command_routes_precede_proposal_detail_route():
    paths = [route.path for route in order_review_public_router.routes]

    detail_index = paths.index("/api/v1/action-proposals/{proposal_id}")
    confirm_index = paths.index("/api/v1/action-proposals/{proposal_id}:confirm")
    reject_index = paths.index("/api/v1/action-proposals/{proposal_id}:reject")

    assert confirm_index < detail_index
    assert reject_index < detail_index
