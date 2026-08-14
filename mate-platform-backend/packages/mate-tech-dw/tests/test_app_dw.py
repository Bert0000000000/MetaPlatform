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
behaviour. All success-path responses use the standard
`{code, message, data: {...}}` wrapper — assertions read from
`body["data"]` rather than `body` directly.
"""
from __future__ import annotations


def _data(r) -> dict:
    """Extract `data` from the standard ApiResponse wrapper."""
    return r.json()["data"]


def test_list_auth_logins(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/auth/login", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 3, data
    assert all(item["tenant_id"] == "tenant-acme" for item in data["items"])
    # Pagination fields are present
    assert {"items", "total", "page", "pageSize", "totalPages"}.issubset(data.keys())


def test_list_collaborations(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/collaborations", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 4, data
    assert all(item["tenant_id"] == "tenant-acme" for item in data["items"])


def test_list_commits(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/commit", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 5, data
    # All five scopes should be represented
    scopes = {item["scope"] for item in data["items"]}
    assert {"kb", "agent", "flow", "form"}.issubset(scopes), scopes


def test_list_documents(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/documents", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 8, data
    kinds = {item["kind"] for item in data["items"]}
    assert {"pdf", "docx", "md", "html"}.issubset(kinds), kinds


def test_upload_document(client, auth_headers_acme) -> None:
    """POST /documents/upload must persist and return the new doc."""
    content = b"%PDF-1.4 fake pdf bytes"
    r = client.post(
        "/api/v1/dw/documents/upload",
        headers=auth_headers_acme,
        files={"file": ("测试文档.pdf", content, "application/pdf")},
        data={"employee_id": "dw-kb-1"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["code"] == 0
    doc = body["data"]
    assert doc["name"] == "测试文档.pdf"
    assert doc["kind"] == "pdf"
    assert doc["size_bytes"] == len(content)
    assert doc["kb_id"] == "dw-kb-1"
    assert doc["tenant_id"] == "tenant-acme"
    assert doc["id"].startswith("dw-doc-")
    # 新增：RAG 入库回填字段（无 RAG 服务时降级为 0 / 空，但仍存在）
    assert doc["document_id"] == doc["id"]
    assert "chunk_count" in doc

    # Verify it now shows up in GET /documents
    r2 = client.get("/api/v1/dw/documents", headers=auth_headers_acme)
    assert r2.status_code == 200, r2.text
    ids = {item["id"] for item in _data(r2)["items"]}
    assert doc["id"] in ids


def test_upload_ingests_to_rag(client, auth_headers_acme, monkeypatch) -> None:
    """Upload must call RAGClient.upload and record the returned chunk_count."""
    from mate_tech_dw import clients as dw_clients

    captured: dict = {}

    def fake_upload(self, file_content, filename, document_id, content_type="text/plain", *, kb_id=None):
        captured["document_id"] = document_id
        captured["filename"] = filename
        captured["size"] = len(file_content)
        captured["content_type"] = content_type
        captured["kb_id"] = kb_id
        return {"document_id": document_id, "chunk_count": 7, "indexed_in": ["hybrid", "graph", "lightrag"]}

    monkeypatch.setattr(dw_clients.RAGClient, "upload", fake_upload)

    content = b"# HR manual\n\n## attendance\n\nlate arrival counts as absence\n\n## hiring\n\nprobation is three months\n"
    r = client.post(
        "/api/v1/dw/documents/upload",
        headers=auth_headers_acme,
        files={"file": ("hr.md", content, "text/markdown")},
        data={"employee_id": "dw-kb-1"},
    )
    assert r.status_code == 200, r.text
    doc = r.json()["data"]
    # RAG ingest result is recorded on the document.
    assert doc["chunk_count"] == 7
    assert doc["document_id"] == captured["document_id"]
    assert captured["filename"] == "hr.md"
    assert captured["size"] == len(content)
    # kb_id (= employee_id) is forwarded to the rag client for isolation.
    assert captured["kb_id"] == "dw-kb-1"
    assert doc["kb_id"] == "dw-kb-1"
    assert captured["content_type"] == "text/markdown"
    assert doc["kb_id"] == "dw-kb-1"


def test_list_employees(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/employees", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 6, data
    role_categories = {item["roleCategory"] for item in data["items"]}
    assert {
        "ONTOLOGY", "WORKFLOW", "APP", "DATA_PRODUCT",
        "OBS", "SECURITY", "KNOWLEDGE",
    }.issubset(role_categories), role_categories


def test_list_employee_tasks(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/employees/tasks", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 12, data
    statuses = {item["status"] for item in data["items"]}
    assert {"success", "failed", "running", "pending"}.issubset(statuses), statuses


def test_list_evaluations(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/evaluations", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 4, data
    assert all(item["tenant_id"] == "tenant-acme" for item in data["items"])


def test_list_extracts(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/extract", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 5, data
    sources = {item["source"] for item in data["items"]}
    assert {"kb", "conversation", "document"}.issubset(sources), sources


def test_list_knowledge_bases(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/knowledge-bases", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 5, data
    assert all(item["tenant_id"] == "tenant-acme" for item in data["items"])


def test_list_learning_extracts(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/learning/extract", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 6, data
    assert all(item["tenant_id"] == "tenant-acme" for item in data["items"])


def test_list_learning_feedback(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/learning/feedback", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 6, data
    ratings = {item["rating"] for item in data["items"]}
    assert ratings.issubset({1, 2, 3, 4, 5}), ratings


def test_list_models(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/models", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 5, data
    providers = {item["provider"] for item in data["items"]}
    assert {"openai", "anthropic", "doubao", "qwen"}.issubset(providers), providers


def test_list_tools(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/tools", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 8, data
    kinds = {item["kind"] for item in data["items"]}
    assert {"mcp", "function", "flow"}.issubset(kinds), kinds


def test_list_traces(client, auth_headers_acme) -> None:
    r = client.get("/api/v1/dw/traces", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["total"] >= 10, data
    statuses = {item["status"] for item in data["items"]}
    assert {"ok", "error", "timeout"}.issubset(statuses), statuses


def test_pagination_works(client, auth_headers_acme) -> None:
    """Page 1 with size=2 must return 2 items and total >= 10."""
    r = client.get(
        "/api/v1/dw/traces",
        params={"page": 1, "size": 2},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    data = _data(r)
    assert data["page"] == 1
    assert data["pageSize"] == 2
    assert data["total"] >= 10
    assert data["totalPages"] >= 5
    assert len(data["items"]) == 2

    # Page 2 must return different items
    r2 = client.get(
        "/api/v1/dw/traces",
        params={"page": 2, "size": 2},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200, r2.text
    data2 = _data(r2)
    ids1 = {item["id"] for item in data["items"]}
    ids2 = {item["id"] for item in data2["items"]}
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
                files={"file": ("smoke.pdf", b"%PDF-1.4", "application/pdf")},
                data={"employee_id": "dw-kb-1"},
            )
        assert r.status_code == 200, f"{method} {path} -> {r.status_code}: {r.text}"