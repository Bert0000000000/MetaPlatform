"""HTTP controller tests for TECH-RAG API endpoints."""

from __future__ import annotations

from httpx import AsyncClient

TENANT = "tenant-test"
TRACE = "test-trace-001"

BASE = "/api/v1/rag"

CREATE_KB_BODY = {
    "name": "api-test-kb",
    "description": "Knowledge base for API testing",
}


# --------------------------------------------------- POST /knowledge-bases


async def test_create_knowledge_base_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST /knowledge-bases creates a knowledge base and returns code 0."""

    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json=CREATE_KB_BODY,
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == TRACE
    data = body["data"]
    assert data["name"] == "api-test-kb"
    assert data["status"] == "ACTIVE"
    assert data["docCount"] == 0
    assert data["id"].startswith("kb-")


# --------------------------------------------- POST /knowledge-bases (dup)


async def test_create_knowledge_base_duplicate_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """Creating two knowledge bases with the same name returns 40901."""

    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json=CREATE_KB_BODY,
        headers=tenant_headers,
    )
    assert resp.status_code == 200

    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json=CREATE_KB_BODY,
        headers=tenant_headers,
    )

    assert resp.status_code == 409
    body = resp.json()
    assert body["code"] == 40901
    assert body["traceId"] == TRACE


# ----------------------------------------- POST /knowledge-bases/{id}/documents/upload


async def test_upload_document_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST .../documents/upload uploads a .txt file successfully."""

    # Create a KB first.
    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json=CREATE_KB_BODY,
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    # Upload a document.
    resp = await client.post(
        f"{BASE}/knowledge-bases/{kb_id}/documents/upload",
        files={"file": ("test.txt", b"Hello RAG world", "text/plain")},
        data={"metadata": '{"source": "api-test"}'},
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["filename"] == "test.txt"
    assert data["fileType"] == "TEXT"
    assert data["fileSize"] == 15
    assert data["status"] == "UPLOADED"
    assert data["metadata"] == {"source": "api-test"}


# ------------------------------- POST .../documents/upload (unsupported type)


async def test_upload_document_unsupported_type_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """Uploading an unsupported file type returns 40005."""

    # Create a KB first.
    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json=CREATE_KB_BODY,
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    resp = await client.post(
        f"{BASE}/knowledge-bases/{kb_id}/documents/upload",
        files={"file": ("bad.exe", b"binary", "application/octet-stream")},
        headers=tenant_headers,
    )

    assert resp.status_code == 400
    body = resp.json()
    assert body["code"] == 40005


# --------------------------------------- GET /knowledge-bases/{id}/documents


async def test_list_documents_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET .../documents returns a paginated list."""

    # Create a KB.
    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json={"name": "list-docs-kb"},
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    # Upload two documents.
    for i in range(2):
        resp = await client.post(
            f"{BASE}/knowledge-bases/{kb_id}/documents/upload",
            files={"file": (f"doc-{i}.md", f"# Doc {i}".encode(), "text/markdown")},
            headers=tenant_headers,
        )
        assert resp.status_code == 200

    resp = await client.get(
        f"{BASE}/knowledge-bases/{kb_id}/documents",
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    assert len(data["items"]) == 2


# ------------------------------------------- DELETE /documents/{id}


async def test_delete_document_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """DELETE /documents/{id} removes the document."""

    # Create a KB.
    resp = await client.post(
        f"{BASE}/knowledge-bases",
        json={"name": "delete-doc-kb"},
        headers=tenant_headers,
    )
    kb_id = resp.json()["data"]["id"]

    # Upload a document.
    resp = await client.post(
        f"{BASE}/knowledge-bases/{kb_id}/documents/upload",
        files={"file": ("to-delete.txt", b"delete me", "text/plain")},
        headers=tenant_headers,
    )
    doc_id = resp.json()["data"]["id"]

    # Delete it.
    resp = await client.delete(
        f"{BASE}/documents/{doc_id}",
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["deleted"] is True
    assert body["data"]["fileDeleted"] is True

    # Verify it's gone.
    resp = await client.get(
        f"{BASE}/documents/{doc_id}",
        headers=tenant_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == 40402


# ----------------------------------------------- GET /health


async def test_health_check(client: AsyncClient) -> None:
    """GET /health returns UP status."""

    resp = await client.get("/health")

    assert resp.status_code == 200
    assert resp.json() == {"status": "UP"}
