"""System-facing workflow run API tests."""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter


def _body() -> dict[str, object]:
    return {
        "version": "1.0",
        "steps": [
            {
                "id": "review",
                "action_type": "order.review",
                "input": {"order_id": "order-1"},
                "requires_confirmation": True,
            }
        ],
        "input": {"priority": "high"},
    }


def test_start_workflow_returns_202_and_queryable_run(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    response = client.post(
        "/api/v1/workflows/order-review/runs",
        json=_body(),
        headers={**auth_headers_acme, "Idempotency-Key": "review-1"},
    )

    assert response.status_code == 202, response.text
    payload = response.json()
    assert payload["run_id"].startswith("run-")
    assert payload["status"] == "running"
    assert payload["status_url"] == f"/api/v1/workflow-runs/{payload['run_id']}"

    status = client.get(payload["status_url"], headers=auth_headers_acme)
    assert status.status_code == 200, status.text
    assert status.json()["run_id"] == payload["run_id"]
    assert status.json()["tenant_id"] == "tenant-acme"
    assert outbox.all_records() == []


def test_start_workflow_is_idempotent_for_same_tenant(
    client, auth_headers_acme,
) -> None:
    headers = {**auth_headers_acme, "Idempotency-Key": "review-replay"}

    first = client.post("/api/v1/workflows/order-review/runs", json=_body(), headers=headers)
    replay = client.post("/api/v1/workflows/order-review/runs", json=_body(), headers=headers)

    assert first.status_code == 202, first.text
    assert replay.status_code == 202, replay.text
    assert replay.json()["run_id"] == first.json()["run_id"]


def test_workflow_run_is_not_visible_to_another_tenant(
    client, auth_headers_acme, auth_headers_globex,
) -> None:
    response = client.post(
        "/api/v1/workflows/order-review/runs",
        json=_body(),
        headers={**auth_headers_acme, "Idempotency-Key": "tenant-bound"},
    )
    run_id = response.json()["run_id"]

    cross_tenant = client.get(
        f"/api/v1/workflow-runs/{run_id}", headers=auth_headers_globex,
    )

    assert cross_tenant.status_code == 404, cross_tenant.text


def test_start_workflow_requires_idempotency_key(client, auth_headers_acme) -> None:
    response = client.post(
        "/api/v1/workflows/order-review/runs",
        json=_body(),
        headers=auth_headers_acme,
    )

    assert response.status_code == 400, response.text


def test_start_workflow_rejects_empty_steps(client, auth_headers_acme) -> None:
    response = client.post(
        "/api/v1/workflows/order-review/runs",
        json={"version": "1.0", "steps": []},
        headers={**auth_headers_acme, "Idempotency-Key": "empty"},
    )

    assert response.status_code == 422, response.text
