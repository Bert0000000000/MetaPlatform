"""Happy-path tests for the mate-tech-dw endpoints (FR-DW-001..015).

15 endpoints under `/api/v1/dw/*`:
  - GET  /auth/login         — digital employee login records
  - GET  /collaborations     — peer collaboration sessions
  - GET  /commit             — commit history (kb/agent/flow/form)
  - GET  /documents          — documents in knowledge bases
  - POST /documents/upload   — upload a new document (stub)
  - GET  /employees          — digital employees
  - GET  /employees/tasks    — employee task history
  - GET  /evaluations        — employee evaluations
  - GET  /extract            — fact extraction records
  - GET  /knowledge-bases    — knowledge bases
  - GET  /learning/extract   — learning extraction records
  - GET  /learning/feedback  — learning feedback records
  - GET  /models             — LLM models available
  - GET  /tools              — tools (mcp / function / flow)
  - GET  /traces             — invocation traces

Each test asserts the response shape, the seed minima declared in
`mate_tech_dw.repositories.in_memory`, and basic pagination
behaviour.
"""
from __future__ import annotations


def test_list_auth_logins(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/auth/login", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 3, body
    assert all(item["tenant_id"] == "tenant-acme" for item in body["items"])
    # Pagination fields are present
    assert {"items", "total", "page", "size", "pages"}.issubset(body.keys())


def test_list_collaborations(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/collaborations", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 4, body
    assert all(item["tenant_id"] == "tenant-acme" for item in body["items"])


def test_list_commits(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/commit", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 5, body
    # All five scopes should be represented
    scopes = {item["scope"] for item in body["items"]}
    assert {"kb", "agent", "flow", "form"}.issubset(scopes), scopes


def test_list_documents(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/documents", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 8, body
    kinds = {item["kind"] for item in body["items"]}
    assert {"pdf", "docx", "md", "html"}.issubset(kinds), kinds


def test_upload_document(client, auth_headers_acme) -> None:
    """POST /documents/upload must persist and return the new doc."""
    r = client.post(
        "/api/v1/dw/documents/upload",
        headers=auth_headers_acme,
        json={
            "name": "测试文档.pdf",
            "kind": "pdf",
            "size_bytes": 1024,
            "kb_id": "dw-kb-1",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["code"] == 0
    doc = body["data"]
    assert doc["name"] == "测试文档.pdf"
    assert doc["kind"] == "pdf"
    assert doc["size_bytes"] == 1024
    assert doc["kb_id"] == "dw-kb-1"
    assert doc["tenant_id"] == "tenant-acme"
    assert doc["id"].startswith("dw-doc-")

    # Verify it now shows up in GET /documents
    r2 = client.get("/api/v1/dw/documents", headers=auth_headers_acme)
    assert r2.status_code == 200, r2.text
    ids = {item["id"] for item in r2.json()["items"]}
    assert doc["id"] in ids


def test_list_employees(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/employees", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 6, body
    roles = {item["role"] for item in body["items"]}
    assert {"CS_AGENT", "SALES", "ANALYST", "OPS"}.issubset(roles), roles


def test_list_employee_tasks(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/employees/tasks", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 12, body
    statuses = {item["status"] for item in body["items"]}
    assert {"success", "failed", "running", "pending"}.issubset(statuses), statuses


def test_list_evaluations(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/evaluations", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 4, body
    assert all(item["tenant_id"] == "tenant-acme" for item in body["items"])


def test_list_extracts(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/extract", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 5, body
    sources = {item["source"] for item in body["items"]}
    assert {"kb", "conversation", "document"}.issubset(sources), sources


def test_list_knowledge_bases(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/knowledge-bases", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 5, body
    assert all(item["tenant_id"] == "tenant-acme" for item in body["items"])


def test_list_learning_extracts(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/learning/extract", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 6, body
    assert all(item["tenant_id"] == "tenant-acme" for item in body["items"])


def test_list_learning_feedback(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/learning/feedback", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 6, body
    ratings = {item["rating"] for item in body["items"]}
    assert ratings.issubset({1, 2, 3, 4, 5}), ratings


def test_list_models(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/models", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 5, body
    providers = {item["provider"] for item in body["items"]}
    assert {"openai", "anthropic", "doubao", "qwen"}.issubset(providers), providers


def test_list_tools(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/tools", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 8, body
    kinds = {item["kind"] for item in body["items"]}
    assert {"mcp", "function", "flow"}.issubset(kinds), kinds


def test_list_traces(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/traces", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 10, body
    statuses = {item["status"] for item in body["items"]}
    assert {"ok", "error", "timeout"}.issubset(statuses), statuses


def test_pagination_works(client, auth_headers_acme) -> None:
    """Page 1 with size=2 must return 2 items and total >= 10."""
    r = client.get(
        "/api/v1/dw/traces",
        params={"page": 1, "size": 2},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["page"] == 1
    assert body["size"] == 2
    assert body["total"] >= 10
    assert body["pages"] >= 5
    assert len(body["items"]) == 2

    # Page 2 must return different items
    r2 = client.get(
        "/api/v1/dw/traces",
        params={"page": 2, "size": 2},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200, r2.text
    body2 = r2.json()
    ids1 = {item["id"] for item in body["items"]}
    ids2 = {item["id"] for item in body2["items"]}
    assert not (ids1 & ids2), "page 1 and 2 must not overlap"


def test_all_15_endpoints_respond(client, auth_headers_acme) -> None:
    """Smoke test: all 15 endpoints must return 200.

    Enumerates every path declared in dw.yaml to make sure no
    endpoint is accidentally dropped during refactor.
    """
    paths = [
        ("GET", "/api/v1/dw/auth/login"),
        ("GET", "/api/v1/dw/collaborations"),
        ("GET", "/api/v1/dw/commit"),
        ("GET", "/api/v1/dw/documents"),
        ("POST", "/api/v1/dw/documents/upload"),
        ("GET", "/api/v1/dw/employees"),
        ("GET", "/api/v1/dw/employees/tasks"),
        ("GET", "/api/v1/dw/evaluations"),
        ("GET", "/api/v1/dw/extract"),
        ("GET", "/api/v1/dw/knowledge-bases"),
        ("GET", "/api/v1/dw/learning/extract"),
        ("GET", "/api/v1/dw/learning/feedback"),
        ("GET", "/api/v1/dw/models"),
        ("GET", "/api/v1/dw/tools"),
        ("GET", "/api/v1/dw/traces"),
    ]
    for method, path in paths:
        if method == "GET":
            r = client.get(path, headers=auth_headers_acme)
        else:
            r = client.post(
                path, headers=auth_headers_acme,
                json={"name": "smoke.pdf", "kind": "pdf", "size_bytes": 1, "kb_id": "dw-kb-1"},
            )
        assert r.status_code == 200, f"{method} {path} -> {r.status_code}: {r.text}"
