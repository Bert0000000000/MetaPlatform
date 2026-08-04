"""联邦查询引擎测试 — 跨本体 SPARQL 联邦 + 3 种合并策略 (PRD-APP-ONTSTUDIO §6.5)."""
from __future__ import annotations

import time

import jwt as _pyjwt
import pytest
from fastapi.testclient import TestClient

from mate_tech_ont.federation import (
    ClassMapping,
    FederationExecutor,
    FederationQuery,
    OntologyMapping,
    PropertyMapping,
    _executor,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> TestClient:
    from mate_tech_ont.main import app
    return TestClient(app)


@pytest.fixture
def executor() -> FederationExecutor:
    """Fresh executor with a stub query_fn for unit tests."""
    data: dict[str, list[dict]] = {
        "ont-a": [
            {"uri": "a:1", "type": "Concept", "label": "Alpha"},
            {"uri": "a:2", "type": "Concept", "label": "Beta"},
        ],
        "ont-b": [
            {"uri": "b:1", "type": "Term", "label": "Alpha"},
            {"uri": "a:2", "type": "Concept", "label": "Beta"},  # overlaps with ont-a
        ],
    }

    def _query_fn(ont_id: str, query: str) -> list[dict]:
        return list(data.get(ont_id, []))

    return FederationExecutor(query_fn=_query_fn)


_TEST_JWT_SECRET = "test-secret"


def _alt_tenant_headers(tenant_id: str) -> dict[str, str]:
    """Build auth headers for a different tenant (mirrors conftest.make_keycloak_token)."""
    now = int(time.time())
    token = _pyjwt.encode(
        {
            "sub": f"user-{tenant_id}",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": f"user-{tenant_id}",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# OntologyMapping (3 tests)
# ---------------------------------------------------------------------------


class TestOntologyMapping:
    def test_create_mapping(self) -> None:
        """OntologyMapping 基本构造 — source/target + 类/属性映射列表."""
        m = OntologyMapping(
            source_ontology="foaf",
            target_ontology="schema",
            class_mappings=[ClassMapping("Person", "Person")],
            property_mappings=[PropertyMapping("name", "givenName")],
        )
        assert m.source_ontology == "foaf"
        assert m.target_ontology == "schema"
        assert len(m.class_mappings) == 1
        assert len(m.property_mappings) == 1

    def test_mapping_class_correspondence(self) -> None:
        """map_class / has_class_correspondence 双向查找."""
        m = OntologyMapping(
            source_ontology="foaf",
            target_ontology="schema",
            class_mappings=[
                ClassMapping("Person", "Person"),
                ClassMapping("Document", "CreativeWork"),
            ],
        )
        assert m.map_class("Person") == "Person"
        assert m.map_class("Document") == "CreativeWork"
        assert m.map_class("Unknown") is None
        assert m.has_class_correspondence("Person") is True
        assert m.has_class_correspondence("CreativeWork") is True
        assert m.has_class_correspondence("Missing") is False

    def test_mapping_property_correspondence(self) -> None:
        """map_property / has_property_correspondence 双向查找."""
        m = OntologyMapping(
            source_ontology="foaf",
            target_ontology="schema",
            property_mappings=[
                PropertyMapping("name", "givenName"),
                PropertyMapping("mbox", "email"),
            ],
        )
        assert m.map_property("name") == "givenName"
        assert m.map_property("mbox") == "email"
        assert m.map_property("unknown") is None
        assert m.has_property_correspondence("givenName") is True
        assert m.has_property_correspondence("email") is True
        assert m.has_property_correspondence("missing") is False


# ---------------------------------------------------------------------------
# FederationExecutor (6 tests)
# ---------------------------------------------------------------------------


class TestFederationExecutor:
    def test_execute_union_merge(self, executor: FederationExecutor) -> None:
        """union 策略: ont-a + ont-b 的并集(去重)."""
        q = FederationQuery(
            query="SELECT ?s WHERE { ?s rdf:type ?o }",
            target_ontologies=["ont-a", "ont-b"],
            merge_strategy="union",
        )
        results = executor.execute(q)
        uris = {r["uri"] for r in results}
        # ont-a has a:1, a:2; ont-b has b:1, a:2 → union = {a:1, a:2, b:1}
        assert uris == {"a:1", "a:2", "b:1"}
        assert len(results) == 3

    def test_execute_intersection_merge(self, executor: FederationExecutor) -> None:
        """intersection 策略: 仅 a:2 同时出现在两个本体中."""
        q = FederationQuery(
            query="SELECT ?s WHERE { ?s rdf:type ?o }",
            target_ontologies=["ont-a", "ont-b"],
            merge_strategy="intersection",
        )
        results = executor.execute(q)
        uris = {r["uri"] for r in results}
        assert uris == {"a:2"}

    def test_execute_priority_merge(self, executor: FederationExecutor) -> None:
        """priority 策略: ont-b 优先级更高 → b:1 和 a:2 排在前面."""
        q = FederationQuery(
            query="SELECT ?s WHERE { ?s rdf:type ?o }",
            target_ontologies=["ont-a", "ont-b"],
            merge_strategy="priority",
            ontology_priority={"ont-a": 1, "ont-b": 10},
        )
        results = executor.execute(q)
        # ont-b data appears first (b:1, a:2), then ont-a remaining (a:1)
        assert results[0]["uri"] == "b:1"
        assert results[1]["uri"] == "a:2"
        assert results[2]["uri"] == "a:1"

    def test_execute_single_ontology(self, executor: FederationExecutor) -> None:
        """单个目标本体 → 直接返回该本体的结果."""
        q = FederationQuery(
            query="SELECT ?s WHERE { ?s rdf:type ?o }",
            target_ontologies=["ont-a"],
        )
        results = executor.execute(q)
        assert len(results) == 2
        assert {r["uri"] for r in results} == {"a:1", "a:2"}

    def test_execute_no_results(self, executor: FederationExecutor) -> None:
        """目标本体不存在 → 空结果."""
        q = FederationQuery(
            query="SELECT ?s WHERE { ?s rdf:type ?o }",
            target_ontologies=["nonexistent"],
        )
        results = executor.execute(q)
        assert results == []

    def test_register_and_retrieve_mapping(self) -> None:
        """register_mapping → get_mapping / list_mappings 可检索."""
        ex = FederationExecutor()
        m = OntologyMapping(
            source_ontology="foaf",
            target_ontology="schema",
            class_mappings=[ClassMapping("Person", "Person")],
        )
        ex.register_mapping(m, tenant_id="acme")
        assert ex.get_mapping("foaf", "schema", tenant_id="acme") is m
        all_mappings = ex.list_mappings(tenant_id="acme")
        assert len(all_mappings) == 1
        assert all_mappings[0].source_ontology == "foaf"
        # different tenant should NOT see acme's mapping
        assert ex.list_mappings(tenant_id="bob") == []


# ---------------------------------------------------------------------------
# Endpoint tests (4 tests)
# ---------------------------------------------------------------------------


class TestFederationEndpoints:
    def test_federation_query_endpoint(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /federation/query — 在两个本体上查询 + union 合并."""
        _executor.load_ontology("ont-x", [
            {"uri": "x:1", "label": "X1"},
            {"uri": "shared", "label": "Shared"},
        ])
        _executor.load_ontology("ont-y", [
            {"uri": "y:1", "label": "Y1"},
            {"uri": "shared", "label": "Shared"},
        ])
        resp = client.post(
            "/api/v1/ont/federation/query",
            json={
                "query": "SELECT ?s WHERE { ?s rdf:type ?o }",
                "target_ontologies": ["ont-x", "ont-y"],
                "merge_strategy": "union",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 3
        uris = {r["uri"] for r in body["results"]}
        assert uris == {"x:1", "y:1", "shared"}

    def test_create_mapping_endpoint(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /federation/mappings — 创建本体映射."""
        resp = client.post(
            "/api/v1/ont/federation/mappings",
            json={
                "source_ontology": "foaf",
                "target_ontology": "schema",
                "class_mappings": [
                    {"source_class": "Person", "target_class": "Person"},
                ],
                "property_mappings": [
                    {"source_property": "name", "target_property": "givenName"},
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["source_ontology"] == "foaf"
        assert body["target_ontology"] == "schema"
        assert len(body["class_mappings"]) == 1
        assert len(body["property_mappings"]) == 1

    def test_list_mappings_endpoint(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """GET /federation/mappings — 列出已注册映射."""
        # Create two mappings
        for src, tgt in [("foaf", "schema"), ("dublin", "schema")]:
            client.post(
                "/api/v1/ont/federation/mappings",
                json={"source_ontology": src, "target_ontology": tgt},
                headers=auth_headers,
            )
        resp = client.get("/api/v1/ont/federation/mappings", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 2
        sources = {m["source_ontology"] for m in body}
        assert sources == {"foaf", "dublin"}

    def test_cross_tenant_isolation(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """跨租户隔离: tenant-acme 的映射对 tenant-other 不可见."""
        # tenant-acme creates a mapping
        client.post(
            "/api/v1/ont/federation/mappings",
            json={
                "source_ontology": "foaf",
                "target_ontology": "schema",
            },
            headers=auth_headers,
        )
        # tenant-acme sees it
        resp_acme = client.get(
            "/api/v1/ont/federation/mappings", headers=auth_headers
        )
        assert resp_acme.status_code == 200
        assert len(resp_acme.json()) == 1

        # tenant-other does NOT see it
        other_headers = _alt_tenant_headers("tenant-other")
        resp_other = client.get(
            "/api/v1/ont/federation/mappings", headers=other_headers
        )
        assert resp_other.status_code == 200
        assert resp_other.json() == []


# ---------------------------------------------------------------------------
# Merge strategy unit tests (2 tests)
# ---------------------------------------------------------------------------


class TestMergeStrategies:
    def test_merge_deduplicates_by_uri(self) -> None:
        """union 合并: 相同 URI 的行只保留首次出现."""
        ex = FederationExecutor()
        group_a = [
            {"uri": "entity:1", "label": "from-a"},
            {"uri": "entity:2", "label": "only-a"},
        ]
        group_b = [
            {"uri": "entity:1", "label": "from-b"},  # duplicate URI
            {"uri": "entity:3", "label": "only-b"},
        ]
        result = ex.merge_results([group_a, group_b], "union")
        uris = [r["uri"] for r in result]
        assert uris == ["entity:1", "entity:2", "entity:3"]
        # first occurrence wins
        entity1 = next(r for r in result if r["uri"] == "entity:1")
        assert entity1["label"] == "from-a"

    def test_merge_preserves_source_priority(self) -> None:
        """priority 合并: 高优先级组的结果排在前面."""
        ex = FederationExecutor()
        group_low = [{"uri": "low:1"}, {"uri": "shared"}]
        group_high = [{"uri": "high:1"}, {"uri": "shared"}]
        # index 0 = group_low (priority 1), index 1 = group_high (priority 10)
        result = ex.merge_results(
            [group_low, group_high],
            "priority",
            {0: 1, 1: 10},
        )
        # high-priority group first
        assert result[0]["uri"] == "high:1"
        assert result[1]["uri"] == "shared"
        assert result[2]["uri"] == "low:1"
