"""Transactional order-review vertical slice tests.

These tests deliberately exercise the write path against the SQLAlchemy
repository instead of the in-memory plan runner.  The path is the smallest
useful production contract for the v1.0 north-star journey:

    unpaid order -> review proposal -> human confirmation -> follow-up/outbox
"""
from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from mate_tech_orchestrator.api.order_review import OrderReviewService
from mate_tech_orchestrator.api.order_review import public_router as order_review_public_router
from mate_tech_orchestrator.main import create_app

from mate_tech_db.base import create_all, init_engine, reset_engine


@pytest.fixture(autouse=True)
def _sqlite(tmp_path: Path) -> Iterator[None]:  # pyright: ignore[reportUnusedFunction]
    reset_engine()
    init_engine(f"sqlite:///{tmp_path / 'order-review.db'}")
    create_all()
    yield
    reset_engine()


@pytest.fixture
def service() -> OrderReviewService:
    return OrderReviewService()


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


def test_order_review_http_flow_uses_tenant_from_authenticated_context(auth_headers_acme: dict[str, str]):
    client = TestClient(create_app())
    headers = {**auth_headers_acme, "X-Tenant-Id": "tenant-acme"}

    order_response = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "order_id": "order-http-1",
            "amount_cents": 88000,
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
