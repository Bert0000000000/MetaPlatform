"""System-facing workflow run API tests for immutable published Plans."""

from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter


def _plan() -> dict[str, object]:
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


def _prepare_published_definition(client, headers) -> None:
    saved = client.put(
        "/api/v1/workflow-definitions/order-review",
        json={"name": "Order review", "version": 0, "draft_plan": _plan()},
        headers=headers,
    )
    assert saved.status_code == 200, saved.text
    published = client.post(
        "/api/v1/workflow-definitions/order-review:publish",
        headers={**headers, "Idempotency-Key": "publish-order-review"},
    )
    assert published.status_code == 200, published.text


def _body() -> dict[str, object]:
    return {"input": {"priority": "high"}}


def test_start_workflow_returns_202_and_queryable_run(
    client,
    auth_headers_acme,
    outbox: InMemoryOutboxWriter,
) -> None:
    _prepare_published_definition(client, auth_headers_acme)
    response = client.post(
        "/api/v1/workflows/order-review/runs",
        json=_body(),
        headers={**auth_headers_acme, "Idempotency-Key": "review-1"},
    )

    assert response.status_code == 202, response.text
    payload = response.json()
    assert payload["run_id"].startswith("run-")
    assert payload["status"] == "running"
    assert payload["definition_version"] == "1"
    assert payload["status_url"] == f"/api/v1/workflow-runs/{payload['run_id']}"

    status = client.get(payload["status_url"], headers=auth_headers_acme)
    assert status.status_code == 200, status.text
    assert status.json()["run_id"] == payload["run_id"]
    assert status.json()["tenant_id"] == "tenant-acme"
    assert status.json()["definition_version"] == "1"
    types = {record.event.type for record in outbox.all_records()}
    assert {"workflow_definition.published", "workflow_run.started"} <= types


def test_start_workflow_is_idempotent_for_same_tenant(client, auth_headers_acme) -> None:
    _prepare_published_definition(client, auth_headers_acme)
    headers = {**auth_headers_acme, "Idempotency-Key": "review-replay"}

    first = client.post("/api/v1/workflows/order-review/runs", json=_body(), headers=headers)
    replay = client.post("/api/v1/workflows/order-review/runs", json=_body(), headers=headers)

    assert first.status_code == 202, first.text
    assert replay.status_code == 202, replay.text
    assert replay.json()["run_id"] == first.json()["run_id"]


def test_workflow_run_is_not_visible_to_another_tenant(
    client,
    auth_headers_acme,
    auth_headers_globex,
) -> None:
    _prepare_published_definition(client, auth_headers_acme)
    response = client.post(
        "/api/v1/workflows/order-review/runs",
        json=_body(),
        headers={**auth_headers_acme, "Idempotency-Key": "tenant-bound"},
    )
    assert response.status_code == 202, response.text
    run_id = response.json()["run_id"]

    cross_tenant = client.get(f"/api/v1/workflow-runs/{run_id}", headers=auth_headers_globex)
    assert cross_tenant.status_code == 404, cross_tenant.text


def test_start_workflow_requires_idempotency_key(client, auth_headers_acme) -> None:
    _prepare_published_definition(client, auth_headers_acme)
    response = client.post(
        "/api/v1/workflows/order-review/runs", json=_body(), headers=auth_headers_acme
    )
    assert response.status_code == 400, response.text


def test_start_workflow_rejects_browser_supplied_steps(client, auth_headers_acme) -> None:
    _prepare_published_definition(client, auth_headers_acme)
    response = client.post(
        "/api/v1/workflows/order-review/runs",
        json={"steps": []},
        headers={**auth_headers_acme, "Idempotency-Key": "browser-steps"},
    )
    assert response.status_code == 422, response.text
