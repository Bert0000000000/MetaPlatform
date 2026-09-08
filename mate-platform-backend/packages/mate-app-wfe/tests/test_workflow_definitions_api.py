"""HTTP contract for versioned Action Orchestration Plan definitions."""
from __future__ import annotations


def _plan() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {
                "id": "review",
                "type": "action",
                "action_type": "order.review",
                "input": {"order_id": "order-1"},
                "requires_confirmation": True,
            },
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "review"},
            {"source": "review", "target": "end"},
        ],
    }


def _save(client, headers, definition_id: str = "order-review", version: int = 0, plan=None):
    return client.put(
        f"/api/v1/workflow-definitions/{definition_id}",
        json={"name": "Order review", "version": version, "draft_plan": plan or _plan()},
        headers=headers,
    )


def test_definition_get_save_and_tenant_isolation(client, auth_headers_acme, auth_headers_globex) -> None:
    saved = _save(client, auth_headers_acme)
    assert saved.status_code == 200, saved.text
    assert saved.json()["version"] == 1

    fetched = client.get("/api/v1/workflow-definitions/order-review", headers=auth_headers_acme)
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["draft_plan"] == _plan()

    hidden = client.get("/api/v1/workflow-definitions/order-review", headers=auth_headers_globex)
    assert hidden.status_code == 404, hidden.text


def test_definition_save_returns_current_summary_for_stale_version(client, auth_headers_acme) -> None:
    assert _save(client, auth_headers_acme).status_code == 200
    updated = _save(client, auth_headers_acme, version=1)
    assert updated.status_code == 200, updated.text

    stale = _save(client, auth_headers_acme, version=1)
    assert stale.status_code == 409, stale.text
    assert stale.json()["detail"]["code"] == "version_conflict"
    assert stale.json()["detail"]["current"]["version"] == 2


def test_publish_rejects_invalid_plan_and_is_idempotent(client, auth_headers_acme) -> None:
    invalid = _plan()
    invalid["nodes"][1]["action_type"] = "unknown.action"
    assert _save(client, auth_headers_acme, plan=invalid).status_code == 200

    rejected = client.post(
        "/api/v1/workflow-definitions/order-review:publish",
        headers={**auth_headers_acme, "Idempotency-Key": "publish-invalid"},
    )
    assert rejected.status_code == 422, rejected.text
    assert rejected.json()["detail"]["issues"][0]["code"] == "unknown_action_type"

    assert _save(client, auth_headers_acme, version=1).status_code == 200
    headers = {**auth_headers_acme, "Idempotency-Key": "publish-1"}
    first = client.post("/api/v1/workflow-definitions/order-review:publish", headers=headers)
    replay = client.post("/api/v1/workflow-definitions/order-review:publish", headers=headers)
    assert first.status_code == 200, first.text
    assert replay.status_code == 200, replay.text
    assert first.json()["published_version"] == 2
    assert replay.json()["published_version"] == 2


def test_run_resolves_only_published_revision(client, auth_headers_acme) -> None:
    assert _save(client, auth_headers_acme).status_code == 200
    assert client.post(
        "/api/v1/workflow-definitions/order-review:publish",
        headers={**auth_headers_acme, "Idempotency-Key": "publish-1"},
    ).status_code == 200

    started = client.post(
        "/api/v1/workflows/order-review/runs",
        json={"input": {"priority": "high"}},
        headers={**auth_headers_acme, "Idempotency-Key": "run-1"},
    )
    assert started.status_code == 202, started.text
    assert started.json()["definition_version"] == "1"

    caller_steps = client.post(
        "/api/v1/workflows/order-review/runs",
        json={"steps": [{"id": "browser", "action_type": "unknown.action"}]},
        headers={**auth_headers_acme, "Idempotency-Key": "run-browser-steps"},
    )
    assert caller_steps.status_code == 422, caller_steps.text
