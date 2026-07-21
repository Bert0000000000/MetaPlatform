"""Tests for ontology auto-discovery endpoints (V15-06)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.deps import get_llm_client, get_ontology_client
from app.main import app
from app.models.schemas import (
    CandidateConcept,
    CandidateRelation,
    ImportResult,
    SuggestRequest,
    SuggestResponse,
)
from app.services.ontology_discovery_service import LlmSuggestionClient, OntologyClient


class FakeOntologyClient(OntologyClient):
    def __init__(self) -> None:
        super().__init__(base_url="http://fake")
        self.calls: list[dict] = []

    async def import_candidates(self, request) -> ImportResult:
        self.calls.append(request.model_dump(by_alias=True))
        concept_ids = [f"cid-{c.temp_id}" for c in request.concepts if c.selected]
        relation_ids = [f"rid-{r.temp_id}" for r in request.relations if r.selected]
        attr_count = sum(
            len([a for a in c.attributes if a.selected])
            for c in request.concepts
            if c.selected
        )
        return ImportResult(
            createdConcepts=len(concept_ids),
            createdAttributes=attr_count,
            createdRelations=len(relation_ids),
            conceptIds=concept_ids,
            relationIds=relation_ids,
            failed=[],
        )


class FakeLlmSuggestionClient(LlmSuggestionClient):
    def __init__(self, *, fail: bool = False) -> None:
        super().__init__(base_url="http://fake")
        self.fail = fail
        self.last_request: SuggestRequest | None = None

    async def suggest(self, request: SuggestRequest) -> SuggestResponse:
        self.last_request = request
        if self.fail:
            return self._fallback_suggest(request)
        concepts = [
            c.model_copy(update={"name": f"建议-{c.name}", "description": "AI 描述"})
            for c in request.concepts
        ]
        relations = [
            r.model_copy(update={"name": f"建议-{r.name}", "cardinality": "1-N"})
            for r in request.relations
        ]
        return SuggestResponse(concepts=concepts, relations=relations)


@pytest.fixture
def client() -> TestClient:
    app.dependency_overrides.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------


def test_list_data_sources(client: TestClient) -> None:
    resp = client.get("/api/v1/ont/discovery/data-sources")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    ids = {item["id"] for item in data["items"]}
    assert ids == {"ds-ecommerce", "ds-crm"}


# ---------------------------------------------------------------------------
# Analyze
# ---------------------------------------------------------------------------


def test_analyze_returns_concepts_and_relations(client: TestClient) -> None:
    resp = client.post("/api/v1/ont/discovery/analyze", json={"sourceId": "ds-ecommerce"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["sourceId"] == "ds-ecommerce"

    concept_tables = {c["sourceTable"] for c in data["concepts"]}
    assert concept_tables == {"users", "orders", "order_items", "products"}

    relations = data["relations"]
    assert len(relations) == 2
    codes = {r["code"] for r in relations}
    assert "REL_ORDERS_USER_ID" in codes
    assert "REL_ORDER_ITEMS_ORDER_ID" in codes


def test_analyze_filters_tables(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/ont/discovery/analyze",
        json={"sourceId": "ds-ecommerce", "tables": ["users", "orders"]},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["concepts"]) == 2
    assert {c["sourceTable"] for c in data["concepts"]} == {"users", "orders"}
    assert len(data["relations"]) == 1
    assert data["relations"][0]["sourceTable"] == "orders"


def test_analyze_unknown_source_returns_404(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/ont/discovery/analyze", json={"sourceId": "ds-unknown"}
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == 404000


def test_analyze_missing_table_returns_404(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/ont/discovery/analyze",
        json={"sourceId": "ds-ecommerce", "tables": ["ghost"]},
    )
    assert resp.status_code == 404
    assert "ghost" in resp.json()["message"]


# ---------------------------------------------------------------------------
# Suggest
# ---------------------------------------------------------------------------


def test_suggest_enhances_candidates(client: TestClient) -> None:
    app.dependency_overrides[get_llm_client] = lambda: FakeLlmSuggestionClient()
    client2 = TestClient(app)

    concepts = [
        CandidateConcept(
            tempId="c1",
            sourceTable="users",
            code="USERS",
            name="users",
            attributes=[],
        )
    ]
    relations = [
        CandidateRelation(
            tempId="r1",
            sourceTable="orders",
            sourceColumn="user_id",
            targetTable="users",
            targetColumn="id",
            code="REL_ORDERS_USER_ID",
            name="orders_user_id",
        )
    ]

    resp = client2.post(
        "/api/v1/ont/discovery/ds-ecommerce/suggest",
        json={
            "concepts": [c.model_dump(by_alias=True) for c in concepts],
            "relations": [r.model_dump(by_alias=True) for r in relations],
        },
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["concepts"][0]["name"].startswith("建议-")
    assert data["relations"][0]["cardinality"] == "1-N"


def test_suggest_fallback_on_llm_failure(client: TestClient) -> None:
    app.dependency_overrides[get_llm_client] = lambda: FakeLlmSuggestionClient(fail=True)
    client2 = TestClient(app)

    concepts = [
        CandidateConcept(
            tempId="c1",
            sourceTable="users",
            code="USERS",
            name="users",
            attributes=[],
        )
    ]

    resp = client2.post(
        "/api/v1/ont/discovery/ds-ecommerce/suggest",
        json={"concepts": [c.model_dump(by_alias=True) for c in concepts], "relations": []},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["concepts"][0]["name"] == "users"


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


def test_import_creates_concepts_and_relations(client: TestClient) -> None:
    fake = FakeOntologyClient()
    app.dependency_overrides[get_ontology_client] = lambda: fake
    client2 = TestClient(app)

    concepts = [
        CandidateConcept(
            tempId="c-users",
            sourceTable="users",
            code="USERS",
            name="用户",
            attributes=[],
        ),
        CandidateConcept(
            tempId="c-orders",
            sourceTable="orders",
            code="ORDERS",
            name="订单",
            attributes=[],
        ),
    ]
    relations = [
        CandidateRelation(
            tempId="r1",
            sourceTable="orders",
            sourceColumn="user_id",
            targetTable="users",
            targetColumn="id",
            code="REL_ORDERS_USER_ID",
            name="订单属于用户",
        )
    ]

    resp = client2.post(
        "/api/v1/ont/discovery/import",
        json={
            "sourceId": "ds-ecommerce",
            "concepts": [c.model_dump(by_alias=True) for c in concepts],
            "relations": [r.model_dump(by_alias=True) for r in relations],
        },
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["createdConcepts"] == 2
    assert data["createdRelations"] == 1
    assert len(fake.calls) == 1


def test_import_skips_unselected_candidates(client: TestClient) -> None:
    fake = FakeOntologyClient()
    app.dependency_overrides[get_ontology_client] = lambda: fake
    client2 = TestClient(app)

    concept = CandidateConcept(
        tempId="c-users",
        sourceTable="users",
        code="USERS",
        name="用户",
        selected=False,
        attributes=[],
    )

    resp = client2.post(
        "/api/v1/ont/discovery/import",
        json={
            "sourceId": "ds-ecommerce",
            "concepts": [concept.model_dump(by_alias=True)],
            "relations": [],
        },
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["createdConcepts"] == 0
    assert data["createdRelations"] == 0


def test_import_includes_attributes(client: TestClient) -> None:
    fake = FakeOntologyClient()
    app.dependency_overrides[get_ontology_client] = lambda: fake
    client2 = TestClient(app)

    from app.models.schemas import CandidateAttribute

    concept = CandidateConcept(
        tempId="c-users",
        sourceTable="users",
        code="USERS",
        name="用户",
        attributes=[
            CandidateAttribute(
                tempId="a-email",
                code="EMAIL",
                name="邮箱",
                dataType="String",
                sourceColumn="email",
            )
        ],
    )

    resp = client2.post(
        "/api/v1/ont/discovery/import",
        json={
            "sourceId": "ds-ecommerce",
            "concepts": [concept.model_dump(by_alias=True)],
            "relations": [],
        },
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["createdAttributes"] == 1
