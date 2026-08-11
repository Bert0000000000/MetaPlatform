"""Happy-path tests for the copilot endpoints (FR-COPILOT-001..033).

9 tests covering auth login, conversations listing, SQL audit,
SQL generation, SQL execution rejection, multimodal upload,
scheduling intent detection, action matching, and the P2-W4
client-routed code explanation endpoint.
"""
from __future__ import annotations


def test_auth_login_returns_token(client) -> None:
    r = client.post("/api/v1/copilot/auth/login")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"].startswith("stub-copilot-"), body
    assert body["token_type"] == "Bearer"
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


def test_explain_code_via_client(client, auth_headers_acme) -> None:
    """P2-W4: POST /generate/explain-code now drives client.chat().

    The default client falls back to the in-process stub_provider,
    so the explanation must come from the stub's chat reply format
    (which echoes the last user message).
    """
    r = client.post(
        "/api/v1/copilot/generate/explain-code",
        json={"code": "def hello():\n    return 'hi'\n"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    explanation = body["explanation"]
    # The stub chat returns "[stub-copilot] Acknowledged: <last user msg>"
    assert "stub-copilot" in explanation or "Acknowledged" in explanation


def test_actions_execute_by_body(client, auth_headers_acme) -> None:
    """POST /actions/execute fires an action via body (FR-COPILOT-COPILOTPOSTCOPILOTACTIONSEXECUTE)."""
    r = client.post(
        "/api/v1/copilot/actions/execute",
        json={"action_id": "act-send-email", "params": {"to": "alice@example.com"}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["action_id"] == "act-send-email"
    assert body["status"] == "completed"
    assert body["result_id"].startswith("res-")

    # action_name lookup also works
    r2 = client.post(
        "/api/v1/copilot/actions/execute",
        json={"action_name": "Send Email", "params": {}},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["action_id"] == "act-send-email"

    # unknown action → 404
    r3 = client.post(
        "/api/v1/copilot/actions/execute",
        json={"action_id": "act-nope"},
        headers=auth_headers_acme,
    )
    assert r3.status_code == 404, r3.text


def test_generate_process_paginated(client, auth_headers_acme) -> None:
    """GET /generate/process lists generation processes (FR-COPILOT-COPILOTGETCOPILOTGENERATEPROCESS)."""
    r = client.get("/api/v1/copilot/generate/process", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1, body
    assert all(p["tenant_id"] == "tenant-acme" for p in body["items"])
    assert {"page", "size", "pages"} <= set(body.keys())


def test_scheduling_templates_paginated(client, auth_headers_acme) -> None:
    """GET /scheduling/templates lists templates (FR-COPILOT-COPILOTGETCOPILOTSCHEDULINGTEMPLATES)."""
    r = client.get("/api/v1/copilot/scheduling/templates", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1, body
    assert all(t["tenant_id"] == "tenant-acme" for t in body["items"])
    assert {"page", "size", "pages"} <= set(body.keys())


# --- GOVERN-12-01: copilot match_employees fallback_token 透传 ----------------
def test_match_employees_passes_fallback_token(
    client, auth_headers_acme, monkeypatch
) -> None:
    """GOVERN-12-01: match_employees 必须把入站 Authorization 透传为
    fallback_token 给 dw client.list_dw_employees，避免 keycloak
    client_credentials 不可用时 fallback 到 in-memory 伪员工。

    策略：monkeypatch copilot.api.app._get_client 返回一个 stub，记录调用
    的 fallback_token；POST /scheduling/employees/match → 断言 stub 收到
    的 fallback_token 与入站 Authorization header 里的 token 一致。
    """
    from mate_app_copilot.api import app as copilot_app_module

    captured: dict = {}

    class _StubClient:
        async def list_dw_employees(self, *, tenant_id, keyword="", size=200, fallback_token=None):
            captured["tenant_id"] = tenant_id
            captured["keyword"] = keyword
            captured["size"] = size
            captured["fallback_token"] = fallback_token
            # 模拟 5 条 dw 主数据 employee（含 ontology kernel role）
            return [
                {"employeeId": "dw-emp-default-1", "name": "Ontology Engineer",
                 "roleCategory": "PLATFORM", "roleIdentity": "ontology",
                 "capability": "kernel,reasoning"},
            ]

        async def close(self):  # 兼容 AsyncCopilotClient 接口
            pass

    def _stub_get_client(request):
        return _StubClient()

    monkeypatch.setattr(copilot_app_module, "_get_client", _stub_get_client)

    r = client.post(
        "/api/v1/copilot/scheduling/employees/match",
        json={"taskType": "ontology"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # match 返回的 employeeId 必须来自 stub（=dw 主数据），不是 in-memory 兜底
    matched_ids = {m["employeeId"] for m in body.get("items", [])}
    assert "dw-emp-default-1" in matched_ids, body

    # fallback_token 必须是非空字符串，与入站 Authorization header 的 token 段一致
    assert captured["fallback_token"], "fallback_token 未透传"
    inbound_bearer = auth_headers_acme["Authorization"].removeprefix("Bearer ").strip()
    assert captured["fallback_token"] == inbound_bearer, (
        f"fallback_token mismatch: got {captured['fallback_token']!r}, "
        f"expected {inbound_bearer!r}"
    )
    # tenant_id 也必须对位 ctx.tenant_id
    assert captured["tenant_id"] == "tenant-acme"
