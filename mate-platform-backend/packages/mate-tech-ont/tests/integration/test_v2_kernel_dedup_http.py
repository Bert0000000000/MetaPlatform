"""HTTP-level smoke test for MP-DEDUP-01 endpoints.

Verifies precheck / merge / propose-merge via FastAPI TestClient with PG repo.
Uses _pg_available skip pattern like other PG e2e tests.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

import pytest

from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual
from mate_kernel.ontology.types import ObjectType, Property, PropertyFormat

PG_DSN = os.getenv(
    "PG_DSN", "postgresql://meta:meta@localhost:5432/metaplatform_ont_test",
)


def _pg_available() -> bool:
    try:
        import psycopg2  # type: ignore  # noqa: PLC0415
        conn = psycopg2.connect(PG_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(),
    reason=f"PG not reachable at {PG_DSN!r}",
)


@pytest.fixture
def pg_repo() -> Any:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder

    r = PgOntologyRepository(dsn=PG_DSN)
    r.set_embedder(HashEmbedder())
    r._ensure_schema()
    return r


@pytest.fixture(autouse=True)
def _clean_pg(pg_repo) -> None:
    import psycopg2  # type: ignore  # noqa: PLC0415
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ont_link_instance")
            cur.execute("DELETE FROM ont_link_type")
            cur.execute("DELETE FROM ont_interface")
            cur.execute("DELETE FROM ont_property")
            cur.execute("DELETE FROM ont_axiom")
            cur.execute("DELETE FROM ont_function")
            cur.execute("DELETE FROM ont_individual")
            cur.execute("DELETE FROM ont_object_type")
            cur.execute("DELETE FROM ont_action_type")
            cur.execute("DELETE FROM ont_proposal")
        conn.commit()
    finally:
        conn.close()


def _ot(rid: str, display_name: str = "") -> ObjectType:
    tenant = rid.split(".")[1]
    # ObjectType rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，
    # parts[4] 是 slug，parts[3] 是 domain。
    parts = rid.split(".")
    slug = parts[4] if len(parts) >= 6 and ".obj." in rid else parts[3]
    pk_prop = Property(
        rid=ClassRef(f"ont.{tenant}.prop.{slug}-id.v1"),
        type_id="string", nullable=False, primary_key=True,
        title="id", format=PropertyFormat.STRING,
    )
    return ObjectType(
        rid=ClassRef(rid),
        primary_key=(pk_prop.rid,),
        properties=(pk_prop,),
        display_name=display_name,
    )


def _ind(rid: str, class_rid: str, pk: str) -> Individual:
    tenant = rid.split(".")[1]
    # class_rid 形如 ``ont.<tenant>.obj.<domain>.<slug>.v1``，slug 在 parts[4]
    parts = class_rid.split(".")
    slug = parts[4] if len(parts) >= 6 and ".obj." in class_rid else parts[3]
    return Individual(
        rid=rid,
        class_rid=ClassRef(class_rid),
        props=((ClassRef(f"ont.{tenant}.prop.{slug}-id.v1"), pk),),
        primary_key=pk,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        tenant_id=tenant,
    )


@pytest.fixture(scope="module", autouse=True)
def _init_kernel_repo():
    """挂载 PG repo 到 app.state 以便 TestClient 通过 HTTP 走真实 PG。"""
    from mate_tech_ont.main import app
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    from mate_tech_ont.v2_kernel.object_search import HashEmbedder

    r = PgOntologyRepository(dsn=PG_DSN)
    r.set_embedder(HashEmbedder())
    app.state.kernel_repo = r
    yield
    app.state.kernel_repo = None


@pytest.fixture
def client_with_ctx(monkeypatch):
    """TestClient + fake auth ctx（绕过 JWT 签名校验）。"""
    from fastapi.testclient import TestClient

    from mate_platform.auth import middleware as auth_mw
    from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId

    async def fake_dispatch(self, request, call_next):
        request.state.ctx = RequestContext(
            request_id="test-req",
            trace_id="test-trace",
            tenant_id=TenantId("acme"),
            user_id=UserId("alice"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    monkeypatch.setattr(auth_mw.AuthMiddleware, "dispatch", fake_dispatch)

    from mate_tech_ont.main import app as _app
    saved_stack = _app.middleware_stack
    _app.middleware_stack = None
    try:
        yield TestClient(_app)
    finally:
        _app.middleware_stack = saved_stack


class TestDedupHttpE2E:
    """HTTP-level smoke test for /object-types/{precheck,merge,propose-merge}."""

    def test_upsert_same_slug_returns_409_with_hint(self, client_with_ctx, pg_repo):
        # First OT — Customer
        pg_repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))
        # Second OT — same slug, different rid → 409 via SlugConflictError
        payload = {
            "rid": "ont.acme.obj.crm.customer.v2",
            "primary_key": ["ont.acme.prop.customer-id.v1"],
            "properties": [{
                "rid": "ont.acme.prop.customer-id.v1",
                "type_id": "string", "nullable": False,
                "primary_key": True, "title": "id", "format": "string",
            }],
            "display_name": "Customer Dup",
            "interfaces": [], "marking": [],
        }
        r = client_with_ctx.post("/api/v1/ont/v2/object-types", json=payload)
        assert r.status_code == 409, f"got {r.status_code}: {r.text}"
        body = r.json()
        assert body["detail"]["error"] == "slug_conflict"
        assert body["detail"]["existing_rid"] == "ont.acme.obj.crm.customer.v1"
        assert body["detail"]["slug"] == "customer"
        assert "merge" in body["detail"]["hint"].lower()

    def test_precheck_finds_existing_customer(self, client_with_ctx, pg_repo):
        pg_repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))
        r = client_with_ctx.post(
            "/api/v1/ont/v2/object-types/precheck",
            json={"name": "客户", "slug": "customer", "domain": "crm"},
        )
        assert r.status_code == 200
        body = r.json()
        cands = body["candidates"]
        assert len(cands) >= 1
        assert any(c["rid"] == "ont.acme.obj.crm.customer.v1" for c in cands)
        top = next(c for c in cands if c["rid"] == "ont.acme.obj.crm.customer.v1")
        assert top["suggested_action"] in {"merge", "rename", "cancel"}

    def test_merge_endpoint_remaps_individuals(self, client_with_ctx, pg_repo):
        pg_repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))
        pg_repo.upsert_object_type(_ot("ont.acme.obj.crm.client.v1", "Client"))
        pg_repo.create_individual(_ind("ont.acme.ind.customer.1", "ont.acme.obj.crm.customer.v1", "1"))
        pg_repo.create_individual(_ind("ont.acme.ind.customer.2", "ont.acme.obj.crm.customer.v1", "2"))

        r = client_with_ctx.post(
            "/api/v1/ont/v2/object-types/merge",
            json={
                "source_rid": "ont.acme.obj.crm.customer.v1",
                "target_rid": "ont.acme.obj.crm.client.v1",
            },
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        body = r.json()
        assert body["source_rid"] == "ont.acme.obj.crm.customer.v1"
        assert body["target_rid"] == "ont.acme.obj.crm.client.v1"
        assert body["affected_individuals"] == 2
        assert body["source_archived"] is True

        # Verify Individuals moved
        got = pg_repo.get_individual("ont.acme.ind.client.1")
        assert got.class_rid.rid == "ont.acme.obj.crm.client.v1"

    def test_propose_merge_lifecycle_via_api(self, client_with_ctx, pg_repo):
        pg_repo.upsert_object_type(_ot("ont.acme.obj.crm.customer.v1", "Customer"))
        pg_repo.upsert_object_type(_ot("ont.acme.obj.crm.client.v1", "Client"))
        pg_repo.create_individual(_ind("ont.acme.ind.customer.1", "ont.acme.obj.crm.customer.v1", "1"))

        # 1) propose
        r = client_with_ctx.post(
            "/api/v1/ont/v2/object-types/propose-merge",
            json={
                "source_rid": "ont.acme.obj.crm.customer.v1",
                "target_rid": "ont.acme.obj.crm.client.v1",
                "similarity": 0.92,
                "impact_summary": "AI detected merge opportunity",
            },
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        prop = r.json()
        assert prop["status"] == "pending"
        assert prop["kind"] == "merge_suggestion"
        pid = prop["proposal_id"]

        # 2) confirm
        r = client_with_ctx.post(
            f"/api/v1/ont/v2/proposals/{pid}/confirm",
            json={"confirmed_by": "alice"},
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        assert r.json()["status"] == "confirmed"

        # 3) execute
        r = client_with_ctx.post(f"/api/v1/ont/v2/proposals/{pid}/execute")
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        body = r.json()
        assert body["kind"] == "merge_suggestion"
        assert body["source_rid"] == "ont.acme.obj.crm.customer.v1"
        assert body["affected_individuals"] == 1

        # 4) final proposal status = applied
        r = client_with_ctx.get(f"/api/v1/ont/v2/proposals/{pid}")
        assert r.json()["status"] == "applied"
