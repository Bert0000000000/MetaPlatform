"""PostgreSQL durability tests for the ontology proposal lifecycle."""

from __future__ import annotations

import os

import psycopg2  # type: ignore[import-untyped]
import pytest

from mate_kernel.action.engine import ProposalStatus
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
