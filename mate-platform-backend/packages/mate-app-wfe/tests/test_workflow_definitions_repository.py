"""Repository contract for persistent, versioned Plan definitions."""
from __future__ import annotations

import pytest
from mate_app_wfe.repositories import in_memory as repository


@pytest.fixture(autouse=True)
def _clean_store() -> None:
    repository.reset_store()


def _plan(step_name: str = "review_order") -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "review", "type": "action", "action_type": step_name},
            {"id": "end", "type": "end"},
        ],
        "edges": [{"source": "start", "target": "review"}, {"source": "review", "target": "end"}],
    }


def test_save_definition_is_tenant_scoped_and_versions_are_optimistic() -> None:
    created = repository.save_workflow_definition(
        "tenant-acme", "order-review", name="Order review", draft_plan=_plan(), expected_version=0,
    )
    assert created.version == 1
    assert repository.get_workflow_definition("tenant-globex", "order-review") is None

    updated = repository.save_workflow_definition(
        "tenant-acme", "order-review", name="Order review v2", draft_plan=_plan("follow_up"),
        expected_version=created.version,
    )
    assert updated.version == 2
    assert updated.draft_plan["nodes"][1]["action_type"] == "follow_up"

    with pytest.raises(repository.WorkflowDefinitionConflict) as conflict:
        repository.save_workflow_definition(
            "tenant-acme", "order-review", name="stale", draft_plan=_plan(), expected_version=1,
        )
    assert conflict.value.current.version == 2
    assert conflict.value.current.summary()["name"] == "Order review v2"


def test_publish_creates_immutable_revision_that_retains_exact_plan() -> None:
    draft = _plan()
    definition = repository.save_workflow_definition(
        "tenant-acme", "order-review", name="Order review", draft_plan=draft, expected_version=0,
    )
    published, revision = repository.publish_workflow_definition(
        "tenant-acme", "order-review", actor_id="u-1",
    )
    assert published.published_version == definition.version
    assert revision.version == definition.version
    assert revision.plan == draft

    draft["nodes"][1]["action_type"] = "mutated_after_publish"
    updated = repository.save_workflow_definition(
        "tenant-acme", "order-review", name="Order review", draft_plan=draft,
        expected_version=published.version,
    )
    assert updated.version == 2

    resolved = repository.resolve_published_workflow_definition("tenant-acme", "order-review")
    assert resolved is not None
    assert resolved.plan["nodes"][1]["action_type"] == "review_order"
