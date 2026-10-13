"""Task 2 loopback-only fixture: real ontology router/auth context and independent PG."""
import os
import time
from datetime import UTC, datetime
from urllib.parse import urlparse
import jwt
import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
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
late_source = f"ont.{tenant}.obj.z_customer"
with repo.tenant_scope(tenant):
    for index in range(101):
        repo.upsert_object_type(ObjectType(rid=ClassRef(f"ont.{tenant}.obj.filler{index:03}"),
            primary_key=(pk.rid,), properties=(pk,), interfaces=(), display_name=f"Filler {index:03}"))
    repo.upsert_object_type(ObjectType(rid=ClassRef(late_source), primary_key=(pk.rid,),
        properties=(pk,), interfaces=(), display_name="Later Customer"))
    for index in range(3, 202):
        key = f"C{index:03}"
        repo.create_individual(Individual(rid=f"ont.{tenant}.ind.{key.lower()}", class_rid=ClassRef(customer),
            primary_key=key, props=((pk.rid, key),), tenant_id=tenant, created_at=now, updated_at=now))
    paged_link = ClassRef(f"ont.{tenant}.link.paged_relationship")
    repo.upsert_link_type(LinkType(rid=paged_link, src=ClassRef(customer), dst=ClassRef(order),
        cardinality=Cardinality.MANY_TO_MANY, directionality=Directionality.DIRECTED))
    from mate_kernel.ontology import LinkInstance
    for index in range(1, 201):
        repo.create_link_instance(LinkInstance(rid=f"ont.{tenant}.lnk.paged{index:03}", link_type_rid=paged_link,
            src=f"ont.{tenant}.ind.c{index:03}", dst=f"ont.{tenant}.ind.o002", props=(),
            tenant_id=tenant, created_at=now), require_endpoints=True)
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
install_auth(app, extra_anonymous_paths={"/__mp11/session", "/__mp11/fault/catalog", "/__mp11/fault/page", "/__mp11/fault/clear"})
app.include_router(router)
app.state.kernel_repo = repo
# Explicit fixture-only transient error injection; normal business reads/writes use actual PG.
faults = {"catalog": False, "page": False}
@app.middleware("http")
async def transient_read_failure(request, call_next):
    is_catalog = request.method == "GET" and request.url.path.endswith("/link-types")
    is_page = request.method == "GET" and request.url.path.endswith("/link-instances") and request.query_params.get("offset") == "200"
    if (is_catalog and faults["catalog"]) or (is_page and faults["page"]):
        return JSONResponse(status_code=503, content={"detail": "MP11 injected transient read failure"})
    return await call_next(request)
@app.post("/__mp11/fault/{kind}")
def set_fault(kind: str):
    if kind == "clear":
        faults.update(catalog=False, page=False)
    elif kind in faults:
        faults[kind] = True
    return {"armed": kind}

def token(scopes):
    return jwt.encode({"sub": "mp11-ui-test", "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend", "azp": "metaplatform-backend", "tenant_id": tenant,
        "attributes": {"tenant_id": [tenant]}, "scope": scopes, "preferred_username": "mp11-ui-test",
        "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]}, "iat": int(time.time()),
        "exp": int(time.time()) + 3600}, os.environ["SERVICE_CLIENT_SECRET"], algorithm="HS256")

@app.get("/__mp11/session")
def session():
    # Fixture identity only. Signature bypass belongs exclusively to this dedicated process.
    return {"tenant": tenant, "customer": customer, "order": order, "lateSource": late_source, "token": token("platform.read platform.write"),
            "readToken": token("platform.read")}
@app.get("/healthz")
def health():
    return {"status": "ok", "scope": "mp11-isolated-test-api"}
uvicorn.run(app, host="127.0.0.1", port=55498, access_log=False)
