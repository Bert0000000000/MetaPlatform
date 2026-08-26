"""Tests for the Temporal-to-order-review action adapter."""
from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from mate_tech_orchestrator.repositories.order_review import OrderReviewService
from mate_tech_orchestrator.workflow_actions import OrderReviewActionExecutor

from mate_tech_db.base import create_all, init_engine, reset_engine


@pytest.fixture(autouse=True)
def _sqlite(tmp_path: Path) -> Iterator[None]:
    reset_engine()
    init_engine(f"sqlite:///{tmp_path / 'workflow-actions.db'}")
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
        source_refs=["ontology://Order/order-1001"],
    )
    return str(result["proposal_id"])


def _payload(proposal_id: str, *, tenant_id: str = "tenant-acme") -> dict[str, object]:
    return {
        "run_id": "run-order-review-1001",
        "tenant_id": tenant_id,
        "step": {
            "id": "confirm-order-review",
            "action_type": "order_review_confirm",
            "requires_confirmation": True,
            "input": {
                "proposal_id": proposal_id,
                "actor_id": "temporal-reviewer",
                "trace_id": "trace-order-review-1001",
            },
        },
    }


@pytest.mark.asyncio
async def test_executor_confirms_proposal_through_transactional_service(
    service: OrderReviewService,
):
    proposal_id = _seed_proposal(service)

    result = await OrderReviewActionExecutor(service=service).execute(_payload(proposal_id))

    assert result["status"] == "confirmed"
    assert result["proposal_id"] == proposal_id
    assert service.get_order(tenant_id="tenant-acme", order_id="order-1001")["review_status"] == "approved"
    assert len(service.list_follow_up_tasks(tenant_id="tenant-acme")) == 1
    events = service.list_outbox_events(tenant_id="tenant-acme")
    assert len(events) == 3
    assert events[-1]["trace_id"] == "trace-order-review-1001"


@pytest.mark.asyncio
async def test_executor_replay_is_idempotent_and_does_not_duplicate_side_effects(
    service: OrderReviewService,
):
    proposal_id = _seed_proposal(service)
    executor = OrderReviewActionExecutor(service=service)
    payload = _payload(proposal_id)

    first = await executor.execute(payload)
    second = await executor.execute(payload)

    assert second == first
    assert len(service.list_follow_up_tasks(tenant_id="tenant-acme")) == 1
    assert len(service.list_outbox_events(tenant_id="tenant-acme")) == 3


@pytest.mark.asyncio
async def test_executor_uses_temporal_tenant_boundary_for_proposal_lookup(
    service: OrderReviewService,
):
    proposal_id = _seed_proposal(service)

    with pytest.raises(OrderReviewService.NotFound):
        await OrderReviewActionExecutor(service=service).execute(
            _payload(proposal_id, tenant_id="tenant-globex"),
        )

    assert service.list_follow_up_tasks(tenant_id="tenant-acme") == []


@pytest.mark.asyncio
async def test_executor_fails_closed_for_unsupported_action():
    payload = _payload("proposal-1")
    payload["step"] = {
        "id": "unsupported",
        "action_type": "send_email",
        "input": {"proposal_id": "proposal-1"},
    }

    with pytest.raises(ValueError, match="unsupported workflow action"):
        await OrderReviewActionExecutor().execute(payload)


@pytest.mark.asyncio
async def test_executor_fails_closed_when_proposal_id_is_missing():
    payload = _payload("proposal-1")
    payload["step"] = {
        "id": "confirm-order-review",
        "action_type": "order_review_confirm",
        "input": {},
    }

    with pytest.raises(ValueError, match="proposal_id"):
        await OrderReviewActionExecutor().execute(payload)


@pytest.mark.asyncio
async def test_executor_rejects_blank_explicit_idempotency_key(service: OrderReviewService):
    proposal_id = _seed_proposal(service)
    payload = _payload(proposal_id)
    payload["step"]["input"]["idempotency_key"] = "  "  # type: ignore[index]

    with pytest.raises(ValueError, match="idempotency_key"):
        await OrderReviewActionExecutor(service=service).execute(payload)
