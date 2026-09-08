"""PostgreSQL durability tests for the ontology proposal lifecycle."""

from __future__ import annotations

import os

import psycopg2  # type: ignore[import-untyped]
import pytest

from mate_kernel.action.engine import ProposalStatus
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.types import ActionType, ObjectType, Property, PropertyFormat
from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

PG_DSN = os.getenv(
    "PG_DSN", "postgresql://meta:meta@localhost:5432/metaplatform_ont_test",
)


def _pg_available() -> bool:
    try:
        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(), reason=f"PG not reachable at {PG_DSN!r}",
)


@pytest.fixture
def repo():
    return PgOntologyRepository(dsn=PG_DSN)


@pytest.fixture(autouse=True)
def _clean_proposals(repo) -> None:
    repo._ensure_schema()
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_proposal")
        conn.commit()
    finally:
        conn.close()


def test_confirmed_proposal_retains_ordered_events_after_repository_restart(repo) -> None:
    proposal = repo.propose_model_type(
        type_def={
            "rid": "ont.acme.obj.proposal-event.v1",
            "primary_key": ["ont.acme.prop.proposal-event-id.v1"],
            "properties": [],
            "display_name": "Proposal event",
            "interfaces": [],
            "marking": [],
        },
        impact_summary="persist transition evidence",
    )
    repo.confirm_proposal(proposal.proposal_id, confirmed_by="user-1")

    restarted = PgOntologyRepository(dsn=PG_DSN)
    restored = restarted.get_proposal(proposal.proposal_id)
    events = restarted.list_proposal_events(proposal.proposal_id)

    assert restored.status is ProposalStatus.CONFIRMED
    assert [(event["from_status"], event["to_status"], event["actor_id"]) for event in events] == [
        (None, "pending", None),
        ("pending", "confirmed", "user-1"),
    ]


def test_confirm_idempotency_replays_without_duplicate_transition_event(repo) -> None:
    proposal = repo.propose_model_type(
        type_def={
            "rid": "ont.acme.obj.proposal-idempotency.v1",
            "primary_key": ["ont.acme.prop.proposal-idempotency-id.v1"],
            "properties": [],
            "display_name": "Proposal idempotency",
            "interfaces": [],
            "marking": [],
        },
        impact_summary="idempotent confirm",
    )

    first = repo.confirm_proposal(
        proposal.proposal_id, confirmed_by="user-1", idempotency_key="confirm-1",
    )
    replayed = repo.confirm_proposal(
        proposal.proposal_id, confirmed_by="user-1", idempotency_key="confirm-1",
    )

    assert first == replayed
    assert [event["to_status"] for event in repo.list_proposal_events(proposal.proposal_id)] == [
        "pending", "confirmed",
    ]


def test_repository_migrates_legacy_applied_status_to_executed(repo) -> None:
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ont_proposal
                    (proposal_id, tenant_id, action_rid, parameters, impact_summary,
                     expected_diff, status, kind)
                VALUES ('prop-legacy-applied', 'acme', 'ont.acme.obj.legacy.v1',
                        '{}'::jsonb, 'legacy proposal', '{}'::jsonb, 'applied', 'model_type')
                """,
            )
        conn.commit()
    finally:
        conn.close()

    restarted = PgOntologyRepository(dsn=PG_DSN)

    assert restarted.get_proposal("prop-legacy-applied").status is ProposalStatus.EXECUTED


def test_execute_idempotency_replays_persisted_result_without_duplicate_event(repo) -> None:
    proposal = repo.propose_model_type(
        type_def={
            "rid": "ont.acme.obj.execution-receipt.v1",
            "primary_key": ["ont.acme.prop.execution-receipt-id.v1"],
            "properties": [
                {
                    "rid": "ont.acme.prop.execution-receipt-id.v1",
                    "type_id": "string",
                    "nullable": False,
                    "primary_key": True,
                    "title": "id",
                    "format": "string",
                },
            ],
            "display_name": "Execution receipt",
            "interfaces": [],
            "marking": [],
        },
        impact_summary="persist an execution receipt",
    )
    repo.confirm_proposal(
        proposal.proposal_id, confirmed_by="reviewer-1", idempotency_key="confirm-execute-1",
    )

    first = repo.execute_proposal(
        proposal.proposal_id, actor_id="executor-1", idempotency_key="execute-1",
    )
    replayed = repo.execute_proposal(
        proposal.proposal_id, actor_id="executor-1", idempotency_key="execute-1",
    )

    assert first == {
        "kind": "model_type",
        "type_rid": "ont.acme.obj.execution-receipt.v1",
    }
    assert replayed == first
    assert repo.get_proposal_execution(proposal.proposal_id) == first
    assert [
        (event["from_status"], event["to_status"], event["actor_id"])
        for event in repo.list_proposal_events(proposal.proposal_id)
    ] == [
        (None, "pending", None),
        ("pending", "confirmed", "reviewer-1"),
        ("confirmed", "executed", "executor-1"),
    ]


def _confirmed_action_proposal(repo: PgOntologyRepository):
    """Create a no-op action proposal with one auditable side effect."""
    object_rid = ClassRef("ont.acme.obj.proposal-action.v1")
    primary_key = ClassRef("ont.acme.prop.proposal-action-id.v1")
    action_rid = ClassRef("ont.acme.act.proposal-action.v1")
    target_iid = "ont.acme.ind.proposal-action.1"
    repo.upsert_object_type(
        ObjectType(
            rid=object_rid,
            primary_key=(primary_key,),
            properties=(
                Property(
                    rid=primary_key,
                    type_id="string",
                    nullable=False,
                    primary_key=True,
                    title="id",
                    format=PropertyFormat.STRING,
                ),
            ),
            display_name="Proposal Action Target",
        )
    )
    repo.upsert_action_type(
        ActionType(
            rid=action_rid,
            parameters=(),
            submission_criteria=(),
            side_effects=("notify",),
            function_ref=ClassRef("ont.acme.fn.proposal-action.v1"),
            on=(object_rid,),
        )
    )
    from datetime import UTC, datetime

    now = datetime.now(UTC)
    repo.create_individual(
        Individual(
            rid=target_iid,
            class_rid=object_rid,
            props=((primary_key, "1"),),
            primary_key="1",
            created_at=now,
            updated_at=now,
            tenant_id="acme",
        )
    )
    proposal = repo.propose_action(
        action_rid,
        parameters={},
        target_iid=target_iid,
        impact_summary="execute through the confirmed proposal boundary",
    )
    return repo.confirm_proposal(
        proposal.proposal_id,
        confirmed_by="reviewer-1",
        idempotency_key="confirm-action-proposal",
    )


def test_action_proposal_execution_persists_audit_and_outbox_receipt(repo) -> None:
    """A confirmed action executes once through the proposal boundary."""
    proposal = _confirmed_action_proposal(repo)
    emitted: list[tuple[str, str, dict[str, object]]] = []

    def write_outbox(event_type: str, tenant_id: str, payload: dict[str, object]) -> str:
        emitted.append((event_type, tenant_id, payload))
        return "outbox-action-1"

    repo.set_outbox_writer(write_outbox)
    first = repo.execute_proposal(
        proposal.proposal_id,
        actor_id="executor-1",
        idempotency_key="execute-action-proposal",
    )
    replayed = repo.execute_proposal(
        proposal.proposal_id,
        actor_id="executor-1",
        idempotency_key="execute-action-proposal",
    )

    assert first == replayed
    assert first["kind"] == "action"
    assert first["action_rid"] == "ont.acme.act.proposal-action.v1"
    assert first["target_iid"] == "ont.acme.ind.proposal-action.1"
    assert first["audit_id"]
    assert first["outbox_event_ids"] == ["outbox-action-1"]
    assert emitted == [
        (
            "notify",
            "acme",
            {
                "action_rid": "ont.acme.act.proposal-action.v1",
                "target_iid": "ont.acme.ind.proposal-action.1",
                "proposal_id": proposal.proposal_id,
            },
        )
    ]
    assert repo.get_proposal_execution(proposal.proposal_id) == first
    assert repo.get_proposal(proposal.proposal_id).status is ProposalStatus.EXECUTED


def test_action_proposal_execution_keeps_confirmed_when_outbox_fails(repo) -> None:
    """Outbox evidence is mandatory: a write failure cannot execute an action."""
    proposal = _confirmed_action_proposal(repo)

    def fail_outbox(*_args: object, **_kwargs: object) -> str:
        raise RuntimeError("outbox unavailable")

    repo.set_outbox_writer(fail_outbox)
    with pytest.raises(RuntimeError, match="outbox unavailable"):
        repo.execute_proposal(
            proposal.proposal_id,
            actor_id="executor-1",
            idempotency_key="execute-action-outbox-failure",
        )

    assert repo.get_proposal(proposal.proposal_id).status is ProposalStatus.CONFIRMED
    with pytest.raises(KeyError, match="proposal execution not found"):
        repo.get_proposal_execution(proposal.proposal_id)


def test_action_proposal_execution_uses_durable_outbox_without_injected_callback(repo) -> None:
    """The PostgreSQL transaction outbox is available in the normal service path."""
    proposal = _confirmed_action_proposal(repo)

    receipt = repo.execute_proposal(
        proposal.proposal_id,
        actor_id="executor-1",
        idempotency_key="execute-action-default-outbox",
    )

    assert receipt["outbox_event_ids"]
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT audit_id FROM ont_action_audit WHERE proposal_id = %s",
                (proposal.proposal_id,),
            )
            audit_rows = cur.fetchall()
            cur.execute(
                "SELECT event_id FROM ont_outbox_event WHERE proposal_id = %s",
                (proposal.proposal_id,),
            )
            outbox_rows = cur.fetchall()
    finally:
        conn.close()
    assert audit_rows == [(receipt["audit_id"],)]
    assert outbox_rows == [(receipt["outbox_event_ids"][0],)]
