"""GOVERN-12-05: collection-level POST /api/v1/dw/evaluations tests.

Three tests:

  1. Happy path — POST returns 201, response payload has id/score/employee_id
     and grade, and the record is visible via the collection GET.
  2. Out-of-range score (150) is rejected with 422.
  3. Tenant isolation — acme POSTs are invisible to globex GET.
"""
from __future__ import annotations


def _data(r) -> dict:
    """Extract `data` from the standard ApiResponse wrapper."""
    return r.json()["data"]


def test_post_evaluation_creates_record(
    client, auth_headers_acme, acme_emp_id,
) -> None:
    employee_id = acme_emp_id(1)
    payload = {
        "employee_id": employee_id,
        "score": 82.5,
        "passed": True,
        "qa_set_id": "qa-bulk-001",
        "comment": "GOVERN-12-05 bulk import smoke test",
    }
    r = client.post(
        "/api/v1/dw/evaluations", json=payload, headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["employee_id"] == employee_id
    assert data["score"] == 82.5
    assert data["passed"] is True
    assert data["qa_set_id"] == "qa-bulk-001"
    assert data["comment"] == payload["comment"]
    assert data["grade"] == "B"
    assert data["id"].startswith("dw-eval-")
    assert data["tenant_id"] == "tenant-acme"

    # GET collection must now include the new record
    r2 = client.get("/api/v1/dw/evaluations", headers=auth_headers_acme)
    assert r2.status_code == 200, r2.text
    listed = _data(r2)
    ids = {item["id"] for item in listed["items"]}
    assert data["id"] in ids


def test_post_evaluation_score_out_of_range_422(
    client, auth_headers_acme, acme_emp_id,
) -> None:
    payload = {
        "employee_id": acme_emp_id(1),
        "score": 150,
    }
    r = client.post(
        "/api/v1/dw/evaluations", json=payload, headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text


def test_post_evaluation_tenant_isolation(
    client, auth_headers_acme, auth_headers_globex,
) -> None:
    payload = {
        "employee_id": "dw-emp-acme-1",
        "score": 70,
        "qa_set_id": "qa-bulk-002",
    }
    r = client.post(
        "/api/v1/dw/evaluations", json=payload, headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    created_id = _data(r)["id"]

    # globex GET must not see the acme-written row
    r2 = client.get(
        "/api/v1/dw/evaluations", headers=auth_headers_globex,
    )
    assert r2.status_code == 200, r2.text
    listed = _data(r2)
    ids = {item["id"] for item in listed["items"]}
    assert created_id not in ids
    assert all(item["tenant_id"] == "tenant-globex" for item in listed["items"])
