"""Opt-in PostgreSQL concurrency coverage for order-review proposal resolution."""

from __future__ import annotations

import os
import threading
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from mate_tech_orchestrator.order_review import OntologyContract
from mate_tech_orchestrator.repositories.order_review import OrderReviewService
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.schema import CreateSchema, DropSchema

from mate_tech_db.base import create_all, get_engine, init_engine, reset_engine

POSTGRES_URL = os.environ.get("ORDER_REVIEW_POSTGRES_URL", "").strip()
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="ORDER_REVIEW_POSTGRES_URL is not set",
)


class _FakeOntologyCatalog:
    def get_contract(self, *, tenant_id: str, token: str) -> OntologyContract:
        del token
        object_rid = f"ont.{tenant_id}.obj.crm.order.v1"
        return OntologyContract(
            object_type={"rid": object_rid, "title": "订单"},
            action_type={
                "rid": f"ont.{tenant_id}.act.order-review-confirm.v1",
                "title": "订单复核确认",
                "on": [object_rid],
            },
        )


@pytest.fixture
def postgres_engine() -> Iterator[Engine]:
    schema = f"order_review_concurrency_{uuid.uuid4().hex}"
    admin_engine = create_engine(POSTGRES_URL, future=True)
    with admin_engine.begin() as connection:
        connection.execute(CreateSchema(schema))

    scoped_url = make_url(POSTGRES_URL).update_query_dict(
        {"options": f"-csearch_path={schema},public"}
    )
    reset_engine()
    init_engine(scoped_url.render_as_string(hide_password=False))
    create_all()
    try:
        yield get_engine()
    finally:
        reset_engine()
        with admin_engine.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        admin_engine.dispose()


def test_concurrent_confirmations_create_one_resolution(
    postgres_engine: Engine,
) -> None:
    service = OrderReviewService(ontology_catalog=_FakeOntologyCatalog())
    service.create_order(
        tenant_id="tenant-acme",
        order_id="order-postgres-concurrency",
        amount_cents=250_000,
        payment_status="unpaid",
    )
    created = service.create_review_case(
        tenant_id="tenant-acme",
        order_id="order-postgres-concurrency",
        suggestion={"action": "follow_up_payment"},
        source_refs=[],
    )
    proposal_id = str(created["proposal_id"])
    barrier = threading.Barrier(2)
    checked_out_connections: set[tuple[int, int]] = set()
    checkout_guard = threading.Lock()

    def record_checkout(
        dbapi_connection: Any,
        connection_record: Any,
        connection_proxy: Any,
    ) -> None:
        del connection_record, connection_proxy
        with checkout_guard:
            checked_out_connections.add((threading.get_ident(), id(dbapi_connection)))

    event.listen(postgres_engine, "checkout", record_checkout)

    def confirm(idempotency_key: str) -> str:
        barrier.wait(timeout=10)
        try:
            result = service.confirm_proposal(
                tenant_id="tenant-acme",
                proposal_id=proposal_id,
                idempotency_key=idempotency_key,
                actor_id="u-postgres-reviewer",
            )
        except OrderReviewService.AlreadyResolved:
            return "already_resolved"
        return str(result["status"])

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(confirm, "postgres-confirm-a"),
                executor.submit(confirm, "postgres-confirm-b"),
            ]
            results = sorted(future.result(timeout=20) for future in futures)
    finally:
        event.remove(postgres_engine, "checkout", record_checkout)

    assert results == ["already_resolved", "confirmed"]
    assert len({thread_id for thread_id, _ in checked_out_connections}) == 2
    assert len({connection_id for _, connection_id in checked_out_connections}) >= 2
    assert len(service.list_follow_up_tasks(tenant_id="tenant-acme")) == 1
    events = service.list_outbox_events(tenant_id="tenant-acme")
    assert [event["event_type"] for event in events].count("order.review.confirmed") == 1
    assert [event["event_type"] for event in events].count(
        "audit.action_proposal.confirmed"
    ) == 1
