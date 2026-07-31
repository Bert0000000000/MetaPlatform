"""Ontology API tests (ST-5.4.3)."""
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
    assert resp.json()["status"] == "ok"


def test_create_ontology(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.post(
        "/api/v1/ont/ontologies",
        json={"id": "default", "namespace": "default", "description": "Default ontology"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == "default"


def test_create_ontology_conflict(client: TestClient, auth_headers: dict[str, str]) -> None:
    payload = {"id": "conflict-test-ont", "namespace": "default"}
    client.post("/api/v1/ont/ontologies", json=payload, headers=auth_headers)
    resp = client.post("/api/v1/ont/ontologies", json=payload, headers=auth_headers)
    assert resp.status_code == 409


def test_get_ontology_not_found(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.get("/api/v1/ont/ontologies/missing", headers=auth_headers)
    assert resp.status_code == 404


def test_create_class(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.post(
        "/api/v1/ont/classes",
        json={
            "id": "Concept",
            "namespace": "default",
            "label": "Concept",
            "parent": None,
            "properties": [{"name": "label", "type": "string"}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == "Concept"


def test_get_class_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.get("/api/v1/ont/classes/missing", headers=auth_headers)
    assert resp.status_code == 404
