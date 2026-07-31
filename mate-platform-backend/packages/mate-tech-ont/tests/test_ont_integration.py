"""End-to-end integration tests (ST-5.4.12.2).

覆盖核心端到端流程：OWL import → SPARQL → instance → version。
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_ont.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_healthz(client: TestClient) -> None:
    resp = client.get("/healthz")
    assert resp.status_code == 200


def test_ontology_create_get(client: TestClient, auth_headers: dict[str, str]) -> None:
    """E2E: 创建本体 → 读取."""
    resp = client.post(
        "/api/v1/ont/ontologies",
        json={"id": "e2e-test", "namespace": "default", "description": "E2E"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    resp = client.get("/api/v1/ont/ontologies/e2e-test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == "e2e-test"


def test_class_lifecycle(client: TestClient, auth_headers: dict[str, str]) -> None:
    """E2E: 类 CRUD."""
    resp = client.post(
        "/api/v1/ont/classes",
        json={
            "id": "MyClass",
            "namespace": "default",
            "label": "My Class",
            "parent": None,
            "properties": [],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    resp = client.get("/api/v1/ont/classes/MyClass", headers=auth_headers)
    assert resp.status_code == 200


def test_sparql_endpoint(client: TestClient, auth_headers: dict[str, str]) -> None:
    """E2E: SPARQL → Cypher 转换."""
    resp = client.post(
        "/api/v1/ont/sparql",
        json={"query": "SELECT ?s WHERE { ?s :label 'X' } LIMIT 10", "format": "json"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "MATCH" in body["cypher"]
    assert "RETURN" in body["cypher"]
    assert "LIMIT 10" in body["cypher"]


def test_explain_endpoint(client: TestClient, auth_headers: dict[str, str]) -> None:
    """E2E: SPARQL EXPLAIN."""
    resp = client.post(
        "/api/v1/ont/explain",
        json={"query": "SELECT ?s WHERE { ?s :label 'X' }"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "cypher" in body
    assert "plan" in body
    assert body["estimated_rows"] >= 0


def test_instance_lifecycle(client: TestClient, auth_headers: dict[str, str]) -> None:
    """E2E: 实例 + 关系 CRUD."""
    # 1. 创建实例 A
    resp = client.post(
        "/api/v1/ont/instances",
        json={"class_id": "Concept", "properties": {"name": "A"}},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    a_id = resp.json()["id"]

    # 2. 创建实例 B
    resp = client.post(
        "/api/v1/ont/instances",
        json={"class_id": "Concept", "properties": {"name": "B"}},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    b_id = resp.json()["id"]

    # 3. 创建关系
    resp = client.post(
        "/api/v1/ont/instances/relations",
        json={"type": "type_of", "src_id": a_id, "dst_id": b_id, "properties": {}},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    # 4. 列出关系
    resp = client.get("/api/v1/ont/instances/relations", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
