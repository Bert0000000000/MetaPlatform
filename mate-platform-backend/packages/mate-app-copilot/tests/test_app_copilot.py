"""Happy-path tests for the copilot endpoints (FR-COPILOT-001..033).

8 tests covering auth login, conversations listing, SQL audit,
SQL generation, SQL execution rejection, multimodal upload,
scheduling intent detection, and action matching.
"""
from __future__ import annotations


def test_auth_login_returns_token(client) -> None:
    r = client.post("/api/v1/copilot/auth/login")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"].startswith("stub-copilot-"), body
    assert body["token_type"] == "Bearer"  # noqa: S105
    assert body["expires_in"] == 3600
    assert "id" in body["user"]
    assert "name" in body["user"]
    assert "role" in body["user"]


def test_list_conversations(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/copilot/conversations", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 10, body
    assert all(c["tenant_id"] == "tenant-acme" for c in body["items"])


def test_audit_sql_detects_select_star(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/copilot/analysis/audit-sql",
        json={"sql": "SELECT * FROM users"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["risk_level"] in ("medium", "high"), body
    assert any("SELECT *" in issue for issue in body["issues"]), body


def test_generate_sql_returns_select(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/copilot/analysis/generate-sql",
        json={"prompt": "show me all orders", "tables": ["orders"]},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    sql = r.json()["sql"]
    assert "SELECT" in sql.upper(), sql


def test_execute_sql_rejects_delete(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/copilot/analysis/execute-sql",
        json={"sql": "DELETE FROM users"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 403, r.text


def test_multimodal_upload_returns_embedding(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/copilot/chat/multimodal/upload",
        json={"filename": "report.pdf", "content_type": "application/pdf"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "asset_id" in body
    assert body["embedding_dim"] == 1536, body


def test_scheduling_intent_detect(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/copilot/scheduling/intent/detect",
        json={"text": "schedule a meeting with the team"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "schedule" in body["intent"], body
    assert body["confidence"] > 0.0


def test_actions_match(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/copilot/actions/match",
        json={"context": "please send an email to the customer"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1, body
    matched_ids = {a["id"] for a in body["matched"]}
    assert "act-send-email" in matched_ids, matched_ids
