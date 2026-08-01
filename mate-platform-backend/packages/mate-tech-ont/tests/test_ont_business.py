"""P3-W9 ONT 业务深化测试 — SPARQL 真实化 + 推理引擎 + 版本管理 API."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_ont.inference.engine import (
    InferenceEngine,
    SubclassRule,
    TransitivityRule,
)
from mate_tech_ont.instances.store import store as instance_store
from mate_tech_ont.sparql.cypher import execute_sparql
from mate_tech_ont.versioning.store import version_store


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> TestClient:
    from mate_tech_ont.main import app
    return TestClient(app)


TENANT = "acme"


def _mk_inst(class_id: str, props: dict | None = None, ns: str = TENANT):
    return instance_store.create_instance(class_id, props or {}, namespace=ns)


# ---------------------------------------------------------------------------
# Task 1 — SPARQL 真实化
# ---------------------------------------------------------------------------


class TestSparqlInMemory:
    def test_sparql_returns_matching_instances(self) -> None:
        """SELECT ?s ?o WHERE { ?s rdf:type ?o } returns matching instances."""
        _mk_inst("Concept", {"label": "A"})
        _mk_inst("Concept", {"label": "B"})
        _mk_inst("Object", {})

        results = execute_sparql(
            "SELECT ?s ?o WHERE { ?s rdf:type ?o }",
            tenant_id=TENANT,
        )
        assert len(results) == 3
        # Every binding should have s and o mapped
        for r in results:
            assert "s" in r
            assert "o" in r
            assert r["o"] in ("Concept", "Object")

    def test_sparql_filters_by_tenant(self) -> None:
        """SPARQL with tenant_id only returns matching-namespace instances."""
        _mk_inst("Concept", {}, ns=TENANT)
        _mk_inst("Concept", {}, ns="other")

        results = execute_sparql(
            "SELECT ?s WHERE { ?s rdf:type ?o }",
            tenant_id=TENANT,
        )
        assert len(results) == 1

    def test_sparql_empty_when_no_match(self) -> None:
        """No matching triple pattern → empty list."""
        _mk_inst("Concept", {"label": "X"})
        results = execute_sparql(
            "SELECT ?s WHERE { ?s rdf:type NonExistent }",
            tenant_id=TENANT,
        )
        assert results == []

    def test_sparql_property_pattern(self) -> None:
        """SELECT ?s WHERE { ?s :label 'X' } matches property values."""
        _mk_inst("Concept", {"label": "X"})
        _mk_inst("Concept", {"label": "Y"})
        results = execute_sparql(
            "SELECT ?s WHERE { ?s label X }",
            tenant_id=TENANT,
        )
        assert len(results) == 1


# ---------------------------------------------------------------------------
# Task 2 — 推理引擎
# ---------------------------------------------------------------------------


class TestInferenceSubclass:
    def test_inference_subclass_inheritance(self) -> None:
        """SubclassRule: child instance inherits parent's properties."""
        parent = _mk_inst("Animal", {"has_skin": "true", "legs": "4"})
        child = _mk_inst("Dog", {"bark": "loud"})
        instance_store.create_relation("subclass_of", child.id, parent.id)

        engine = InferenceEngine(instance_store)
        result = engine.apply_rules(TENANT, [SubclassRule(rel_type="subclass_of")])

        assert len(result.inherited) == 1
        inh = result.inherited[0]
        assert inh.instance_id == child.id
        assert inh.from_class == "Animal"
        # child already has 'bark', so only has_skin and legs inherited
        assert "has_skin" in inh.properties
        assert "legs" in inh.properties
        assert "bark" not in inh.properties


class TestInferenceTransitivity:
    def test_inference_transitivity(self) -> None:
        """TransitivityRule: A→B, B→C ⟹ A→C."""
        a = _mk_inst("Node")
        b = _mk_inst("Node")
        c = _mk_inst("Node")
        instance_store.create_relation("related_to", a.id, b.id)
        instance_store.create_relation("related_to", b.id, c.id)

        engine = InferenceEngine(instance_store)
        result = engine.apply_rules(
            TENANT, [TransitivityRule(rel_type="related_to")]
        )

        # Should infer A→C (skip existing A→B and B→C)
        inferred_pairs = {(r.src_id, r.dst_id) for r in result.inferred_relations}
        assert (a.id, c.id) in inferred_pairs
        # Existing direct relations should NOT be re-inferred
        assert (a.id, b.id) not in inferred_pairs
        assert (b.id, c.id) not in inferred_pairs


class TestFindPath:
    def test_find_path_shortest(self) -> None:
        """BFS shortest path: A→B→C→D, path A→D is [A,B,C,D]."""
        a = _mk_inst("N")
        b = _mk_inst("N")
        c = _mk_inst("N")
        d = _mk_inst("N")
        instance_store.create_relation("related_to", a.id, b.id)
        instance_store.create_relation("related_to", b.id, c.id)
        instance_store.create_relation("related_to", c.id, d.id)

        engine = InferenceEngine(instance_store)
        path = engine.find_path(TENANT, a.id, d.id, max_depth=10)

        assert path is not None
        assert path[0] == a.id
        assert path[-1] == d.id
        assert len(path) == 4  # shortest path A→B→C→D

    def test_find_path_none_when_unreachable(self) -> None:
        """No path → None."""
        a = _mk_inst("N")
        b = _mk_inst("N")
        engine = InferenceEngine(instance_store)
        assert engine.find_path(TENANT, a.id, b.id, max_depth=5) is None


class TestGetNeighbors:
    def test_get_neighbors_k_hop(self) -> None:
        """K-hop neighbor discovery."""
        # Graph:  A → B → C → D
        #         A → E
        a = _mk_inst("N")
        b = _mk_inst("N")
        c = _mk_inst("N")
        d = _mk_inst("N")
        e = _mk_inst("N")
        instance_store.create_relation("r", a.id, b.id)
        instance_store.create_relation("r", b.id, c.id)
        instance_store.create_relation("r", c.id, d.id)
        instance_store.create_relation("r", a.id, e.id)

        engine = InferenceEngine(instance_store)

        # 1-hop neighbors of A: B and E
        hop1 = set(engine.get_neighbors(TENANT, a.id, depth=1))
        assert hop1 == {b.id, e.id}

        # 2-hop neighbors of A: B, C, E (C reachable via B)
        hop2 = set(engine.get_neighbors(TENANT, a.id, depth=2))
        assert hop2 == {b.id, c.id, e.id}

        # 3-hop neighbors of A: B, C, D, E
        hop3 = set(engine.get_neighbors(TENANT, a.id, depth=3))
        assert hop3 == {b.id, c.id, d.id, e.id}


# ---------------------------------------------------------------------------
# Task 3 — 版本管理 API
# ---------------------------------------------------------------------------


class TestVersionApi:
    def test_version_create_and_get(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """POST creates version, GET /{id} retrieves it."""
        resp = client.post(
            "/api/v1/ont/versions",
            json={
                "ontology_id": "ont-a",
                "version": "v1.0.0",
                "metadata": {"author": "alice"},
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["ontology_id"] == "ont-a"
        assert body["version"] == "v1.0.0"
        assert body["metadata"] == {"author": "alice"}
        vid = body["version_id"]

        # GET detail
        resp2 = client.get(f"/api/v1/ont/versions/{vid}", headers=auth_headers)
        assert resp2.status_code == 200
        assert resp2.json()["version_id"] == vid

    def test_version_list(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET list returns all versions; filter by ontology_id works."""
        client.post(
            "/api/v1/ont/versions",
            json={"ontology_id": "ont-a", "version": "v1.0.0"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/ont/versions",
            json={"ontology_id": "ont-a", "version": "v1.1.0"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/ont/versions",
            json={"ontology_id": "ont-b", "version": "v2.0.0"},
            headers=auth_headers,
        )

        # List all
        resp = client.get("/api/v1/ont/versions", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 3

        # Filter by ontology_id
        resp2 = client.get(
            "/api/v1/ont/versions?ontology_id=ont-a", headers=auth_headers
        )
        assert resp2.status_code == 200
        assert len(resp2.json()) == 2

    def test_version_delete(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """DELETE removes the version; subsequent GET returns 404."""
        resp = client.post(
            "/api/v1/ont/versions",
            json={"ontology_id": "ont-a", "version": "v1.0.0"},
            headers=auth_headers,
        )
        vid = resp.json()["version_id"]

        # DELETE
        resp2 = client.delete(f"/api/v1/ont/versions/{vid}", headers=auth_headers)
        assert resp2.status_code == 200
        assert resp2.json()["deleted"] is True

        # GET → 404
        resp3 = client.get(f"/api/v1/ont/versions/{vid}", headers=auth_headers)
        assert resp3.status_code == 404

    def test_version_create_conflict(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """Duplicate (ontology_id, version) → 409."""
        payload = {"ontology_id": "ont-x", "version": "v1.0.0"}
        client.post("/api/v1/ont/versions", json=payload, headers=auth_headers)
        resp = client.post(
            "/api/v1/ont/versions", json=payload, headers=auth_headers
        )
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Task 4 — 推理 endpoint (HTTP)
# ---------------------------------------------------------------------------


class TestInferenceApi:
    def test_inference_path_endpoint(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /inference/path returns BFS shortest path."""
        # auth_headers JWT carries tenant_id="tenant-acme"
        a = _mk_inst("N", ns="tenant-acme")
        b = _mk_inst("N", ns="tenant-acme")
        c = _mk_inst("N", ns="tenant-acme")
        instance_store.create_relation("r", a.id, b.id)
        instance_store.create_relation("r", b.id, c.id)

        resp = client.get(
            "/api/v1/ont/inference/path",
            params={"source": a.id, "target": c.id, "max_depth": 10},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["found"] is True
        assert body["path"][0] == a.id
        assert body["path"][-1] == c.id

    def test_inference_neighbors_endpoint(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        """GET /inference/neighbors returns K-hop neighbors."""
        a = _mk_inst("N", ns="tenant-acme")
        b = _mk_inst("N", ns="tenant-acme")
        instance_store.create_relation("r", a.id, b.id)

        resp = client.get(
            "/api/v1/ont/inference/neighbors",
            params={"node": a.id, "depth": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert b.id in resp.json()["neighbors"]


# ---------------------------------------------------------------------------
# Task 5 — 租户隔离
# ---------------------------------------------------------------------------


class TestTenantIsolationInference:
    def test_tenant_isolation_inference(self) -> None:
        """Inference only sees instances/relations in the same tenant."""
        # Tenant acme
        a1 = _mk_inst("Node", {}, ns="acme")
        a2 = _mk_inst("Node", {}, ns="acme")
        instance_store.create_relation("related_to", a1.id, a2.id)

        # Tenant bob
        b1 = _mk_inst("Node", {}, ns="bob")
        b2 = _mk_inst("Node", {}, ns="bob")
        b3 = _mk_inst("Node", {}, ns="bob")
        instance_store.create_relation("related_to", b1.id, b2.id)
        instance_store.create_relation("related_to", b2.id, b3.id)

        engine = InferenceEngine(instance_store)

        # acme path: a1→a2 exists, a1→b1 does not (cross-tenant)
        path = engine.find_path("acme", a1.id, b1.id, max_depth=10)
        assert path is None  # cross-tenant unreachable

        # acme neighbors of a1: only a2 (not b1/b2/b3)
        neighbors = set(engine.get_neighbors("acme", a1.id, depth=5))
        assert neighbors == {a2.id}

        # bob transitivity: b1→b2, b2→b3 ⟹ b1→b3
        result = engine.apply_rules(
            "bob", [TransitivityRule(rel_type="related_to")]
        )
        inferred = {(r.src_id, r.dst_id) for r in result.inferred_relations}
        assert (b1.id, b3.id) in inferred
        # acme relation should not appear in bob results
        assert (a1.id, a2.id) not in inferred
