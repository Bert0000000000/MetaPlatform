"""Transactional order-review vertical slice tests.

These tests deliberately exercise the write path against the SQLAlchemy
repository instead of the in-memory plan runner.  The path is the smallest
useful production contract for the v1.0 north-star journey:

    unpaid order -> review proposal -> human confirmation -> follow-up/outbox
"""
from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from mate_tech_orchestrator.api import order_review as order_review_api
from mate_tech_orchestrator.api.order_review import OrderReviewService
from mate_tech_orchestrator.api.order_review import public_router as order_review_public_router
from mate_tech_orchestrator.main import create_app
from mate_tech_orchestrator.order_review import OntologyContract
from mate_tech_orchestrator.repositories.order_review import ActionProposalORM, ReviewCaseORM
from sqlalchemy import select

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


def _seed_proposal(service: OrderReviewService, *, tenant_id: str = "tenant-acme") -> str:
    service.create_order(
        tenant_id=tenant_id,
        order_id="order-1001",
        amount_cents=129900,
        payment_status="unpaid",
    )
    result = service.create_review_case(
        tenant_id=tenant_id,
        order_id="order-1001",
        suggestion={"action": "follow_up_payment", "reason": "high value unpaid"},
        source_refs=["ontology://Order/order-1001", "rag://payment-policy/2026-01"],
        auth_token=TEST_AUTH_TOKEN,
    )
    return str(result["proposal_id"])


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
    proposal_created = next(event for event in events if event["event_type"] == "order.review.proposal_created")
    confirmed = next(event for event in events if event["event_type"] == "order.review.confirmed")
    assert proposal_created["payload"]["evidence_schema_version"] == "order-review-evidence.v1"
    assert proposal_created["payload"]["evidence_fact_ids"] == [
        "fact.amount_cents",
        "fact.payment_status",
        "fact.review_status",
        "fact.version",
    ]
    assert confirmed["payload"]["evidence_order_version"] == 1
    assert "ontology" not in proposal_created["payload"]
    assert "graph" not in confirmed["payload"]


def test_duplicate_confirmation_is_idempotent_and_does_not_duplicate_side_effects(service: OrderReviewService):
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
    assert service.get_proposal(tenant_id="tenant-acme", proposal_id=proposal_id)["status"] == "pending"


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
    assert service.get_order(tenant_id="tenant-acme", order_id="order-1001")["version"] == 1
    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []
    events = service.list_outbox_events(tenant_id="tenant-acme")
    assert events[-1]["event_type"] == "audit.action_proposal.rejected"
    assert events[-1]["payload"]["evidence_schema_version"] == "order-review-evidence.v1"
    assert events[-1]["payload"]["evidence_order_version"] == 1
    assert "graph" not in events[-1]["payload"]


def test_get_proposal_returns_persisted_evidence_snapshot(service: OrderReviewService) -> None:
    proposal_id = _seed_proposal(service)

    proposal = service.get_proposal(tenant_id="tenant-acme", proposal_id=proposal_id)

    assert proposal["evidence"]["status"] == "complete"
    assert proposal["evidence"]["order_version"] == 1
    assert proposal["suggestion"]["evidence_bundle"] == proposal["evidence"]
    assert proposal["source_refs"] == proposal["evidence"]["recommendation"]["source_refs"]


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


def test_order_review_http_flow_uses_tenant_from_authenticated_context(
    monkeypatch: pytest.MonkeyPatch,
    auth_headers_acme: dict[str, str],
):
    monkeypatch.setattr(order_review_api, "_service", OrderReviewService(ontology_catalog=_FakeOntologyCatalog()))
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
    proposal_id = case_response.json()["proposal_id"]

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

    detail_response = client.get(
        f"/api/v1/action-proposals/{proposal_id}",
        headers=headers,
    )
    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["evidence"]["status"] == "complete"

    duplicate_response = client.post(
        f"/api/v1/action-proposals/{proposal_id}:confirm",
        headers={**headers, "Idempotency-Key": "http-confirm-1"},
        json={"actor_id": "u-reviewer"},
    )
    assert duplicate_response.status_code == 200
    assert duplicate_response.json() == confirm_response.json()


def test_action_command_routes_precede_proposal_detail_route():
    paths = [route.path for route in order_review_public_router.routes]

    detail_index = paths.index("/api/v1/action-proposals/{proposal_id}")
    confirm_index = paths.index("/api/v1/action-proposals/{proposal_id}:confirm")
    reject_index = paths.index("/api/v1/action-proposals/{proposal_id}:reject")

    assert confirm_index < detail_index
    assert reject_index < detail_index
