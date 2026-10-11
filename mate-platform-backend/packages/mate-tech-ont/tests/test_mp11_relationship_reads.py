"""Same-database relationship list isolation, including privileged PG test connections."""
import os
from contextlib import nullcontext
from urllib.parse import urlparse
from uuid import uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import jwt
from mate_platform.auth import install_auth
from mate_kernel.ontology import Cardinality, ClassRef, Directionality, InMemoryOntologyRepository, LinkType, ObjectType, Property, PropertyFormat
from mate_tech_ont.v2_kernel.api import router

def token_for(tenant, auth_headers):
    claims = jwt.decode(auth_headers["Authorization"].split()[1], options={"verify_signature": False})
    claims["tenant_id"] = tenant
    claims["attributes"] = {"tenant_id": [tenant]}
    return jwt.encode(claims, "mp11-fixture-only-32-character-key", algorithm="HS256")

def seed(repo, tenant):
    prefix = f"ont.{tenant}."
    pk = Property(rid=ClassRef(prefix + "prop.id"), type_id="string", primary_key=True, nullable=False, title="ID", format=PropertyFormat.STRING)
    scope = repo.tenant_scope(tenant) if hasattr(repo, "tenant_scope") else nullcontext()
    with scope:
        for kind in ("customer", "order"):
            repo.upsert_object_type(ObjectType(rid=ClassRef(prefix + "obj." + kind), primary_key=(pk.rid,),
                properties=(pk,), interfaces=(), display_name=kind))
        repo.upsert_link_type(LinkType(rid=ClassRef(prefix + "link.orders"),
            src=ClassRef(prefix + "obj.customer"), dst=ClassRef(prefix + "obj.order"),
            cardinality=Cardinality.ONE_TO_MANY, directionality=Directionality.DIRECTED))
    return prefix + "link.orders"

@pytest.fixture
def pg_relationship_repo():
    dsn = os.environ.get("MP11_RELATIONSHIP_PG_DSN")
    if not dsn:
        pytest.skip("Requires dedicated codex_mp11_ PostgreSQL database")
    target = urlparse(dsn)
    assert target.hostname in {"127.0.0.1", "localhost"}
    assert target.port and target.port != 5432
    assert target.path.startswith("/codex_mp11_")
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
    return PgOntologyRepository(dsn=dsn)


@pytest.fixture(params=["memory", "pg"])
def relationship_repo(request):
    return InMemoryOntologyRepository() if request.param == "memory" else request.getfixturevalue("pg_relationship_repo")

def test_http_list_never_returns_a_neighbor_tenants_relationship(relationship_repo, auth_headers):
    a, b = "mp11-read-a-" + uuid4().hex, "mp11-read-b-" + uuid4().hex
    own, neighbor = seed(relationship_repo, a), seed(relationship_repo, b)
    app = FastAPI()
    install_auth(app)
    app.include_router(router)
    app.state.kernel_repo = relationship_repo
    with TestClient(app) as client:
        for tenant, expected, denied in ((a, own, neighbor), (b, neighbor, own)):
            response = client.get("/api/v1/ont/v2/link-types",
                headers={"Authorization": "Bearer " + token_for(tenant, auth_headers)})
            assert response.status_code == 200, response.text
            rows = response.json()
            assert [row["rid"] for row in rows] == [expected]
            assert denied not in str(rows)

def test_pg_scoped_list_is_explicitly_filtered_even_for_schema_owner(pg_relationship_repo):
    relationship_repo = pg_relationship_repo
    a, b = "mp11-scope-a-" + uuid4().hex, "mp11-scope-b-" + uuid4().hex
    own, neighbor = seed(relationship_repo, a), seed(relationship_repo, b)
    with relationship_repo.tenant_scope(a):
        assert [str(row.rid) for row in relationship_repo.list_link_types()] == [own]
    # Existing unscoped repository callers retain their global catalogue semantics.
    assert {own, neighbor} <= {str(row.rid) for row in relationship_repo.list_link_types()}
