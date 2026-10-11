"""Task 2 loopback-only fixture: real ontology router/auth context and independent PG."""
import os
import time
from datetime import UTC, datetime
from urllib.parse import urlparse
import jwt
import uvicorn
from fastapi import FastAPI
from mate_platform.auth import install_auth
from mate_kernel.ontology import Cardinality, ClassRef, Directionality, Individual, LinkType, ObjectType, Property, PropertyFormat
from mate_tech_ont.v2_kernel.api import router
from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

target = urlparse(os.environ["MP11_RELATIONSHIP_PG_DSN"])
if target.hostname != "127.0.0.1" or target.port != 55497 or not target.path.startswith("/codex_mp11_ui_"):
    raise RuntimeError("Refusing unexpected MP11 PostgreSQL target")
tenant = os.environ["MP11_UI_TENANT"]
if not tenant.startswith("mp11-ui-"):
    raise RuntimeError("Refusing unexpected test tenant")
repo = PgOntologyRepository(dsn=os.environ["MP11_RELATIONSHIP_PG_DSN"])
repo._ensure_schema()
customer = f"ont.{tenant}.obj.customer"
order = f"ont.{tenant}.obj.order"
pk = Property(rid=ClassRef(f"ont.{tenant}.prop.id"), type_id="string", primary_key=True,
              nullable=False, title="ID", format=PropertyFormat.STRING)
now = datetime.now(UTC)
with repo.tenant_scope(tenant):
    for rid, title in ((customer, "Customer"), (order, "Order")):
        repo.upsert_object_type(ObjectType(rid=ClassRef(rid), primary_key=(pk.rid,),
                                          properties=(pk,), interfaces=(), display_name=title))
    for key, cls in (("C001", customer), ("C002", customer), ("O001", order), ("O002", order)):
        repo.create_individual(Individual(rid=f"ont.{tenant}.ind.{key.lower()}", class_rid=ClassRef(cls),
            primary_key=key, props=((pk.rid, key),), tenant_id=tenant, created_at=now, updated_at=now))
neighbor = "mp11-neighbor-" + tenant.removeprefix("mp11-ui-")
with repo.tenant_scope(neighbor):
    neighbor_pk = Property(rid=ClassRef(f"ont.{neighbor}.prop.id"), type_id="string", primary_key=True,
                           nullable=False, title="ID", format=PropertyFormat.STRING)
    for kind in ("customer", "order"):
        repo.upsert_object_type(ObjectType(rid=ClassRef(f"ont.{neighbor}.obj.{kind}"),
            primary_key=(neighbor_pk.rid,), properties=(neighbor_pk,), interfaces=(), display_name="Neighbor " + kind))
    repo.upsert_link_type(LinkType(rid=ClassRef(f"ont.{neighbor}.link.neighbor_secret"),
        src=ClassRef(f"ont.{neighbor}.obj.customer"), dst=ClassRef(f"ont.{neighbor}.obj.order"),
        cardinality=Cardinality.ONE_TO_MANY, directionality=Directionality.DIRECTED,
        src_display_name="Neighbor Secret Relation"))
app = FastAPI()
install_auth(app, extra_anonymous_paths={"/__mp11/session"})
app.include_router(router)
app.state.kernel_repo = repo

def token(scopes):
    return jwt.encode({"sub": "mp11-ui-test", "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend", "azp": "metaplatform-backend", "tenant_id": tenant,
        "attributes": {"tenant_id": [tenant]}, "scope": scopes, "preferred_username": "mp11-ui-test",
        "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]}, "iat": int(time.time()),
        "exp": int(time.time()) + 3600}, os.environ["SERVICE_CLIENT_SECRET"], algorithm="HS256")

@app.get("/__mp11/session")
def session():
    # Fixture identity only. Signature bypass belongs exclusively to this dedicated process.
    return {"tenant": tenant, "customer": customer, "order": order, "token": token("platform.read platform.write"),
            "readToken": token("platform.read")}
@app.get("/healthz")
def health():
    return {"status": "ok", "scope": "mp11-isolated-test-api"}
uvicorn.run(app, host="127.0.0.1", port=55498, access_log=False)
