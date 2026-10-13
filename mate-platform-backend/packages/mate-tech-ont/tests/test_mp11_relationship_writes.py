"""MP11 writes use the real FastAPI router, auth and repositories."""

from __future__ import annotations

import os
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager, nullcontext
from dataclasses import replace
from datetime import UTC, datetime
from urllib.parse import urlparse
from uuid import uuid4

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mate_kernel.ontology import (
    Cardinality,
    ClassRef,
    Directionality,
    Individual,
    InMemoryOntologyRepository,
    LinkType,
    ObjectType,
    Property,
    PropertyFormat,
)
from mate_kernel.ontology.api import LinkTypeAlreadyExistsError
from mate_platform.auth import install_auth
from mate_tech_ont.v2_kernel.api import router

T = "tenant-acme"
CUSTOMER = f"ont.{T}.obj.customer"
ORDER = f"ont.{T}.obj.order"
OTHER = f"ont.{T}.obj.other"
LINK = f"ont.{T}.link.customer_orders"
C1 = f"ont.{T}.ind.customer.1"
C2 = f"ont.{T}.ind.customer.2"
O1 = f"ont.{T}.ind.order.1"
O2 = f"ont.{T}.ind.order.2"
BASE = "/api/v1/ont/v2"


def _seed(repo):
    pk = Property(
        rid=ClassRef(f"ont.{T}.prop.id"),
        type_id="string",
        primary_key=True,
        nullable=False,
        title="ID",
        format=PropertyFormat.STRING,
    )
    for rid in (CUSTOMER, ORDER, OTHER):
        repo.upsert_object_type(
            ObjectType(
                rid=ClassRef(rid),
                primary_key=(pk.rid,),
                properties=(pk,),
                interfaces=(),
                display_name=rid,
            )
        )
    now = datetime.now(UTC)
    for rid, cls in ((C1, CUSTOMER), (C2, CUSTOMER), (O1, ORDER), (O2, ORDER)):
        repo.create_individual(
            Individual(
                rid=rid,
                class_rid=ClassRef(cls),
                props=((pk.rid, rid),),
                primary_key=rid,
                tenant_id=T,
                created_at=now,
                updated_at=now,
            )
        )


@pytest.fixture
def repo():
    r = InMemoryOntologyRepository()
    _seed(r)
    return r


@pytest.fixture
def client(repo, auth_headers):
    app = FastAPI()
    install_auth(app)
    app.include_router(router)
    app.state.kernel_repo = repo
    with TestClient(app, headers=auth_headers, raise_server_exceptions=False) as c:
        yield c


def _definition(**changes):
    return (
        dict(
            rid=LINK,
            src=CUSTOMER,
            dst=ORDER,
            cardinality="1:N",
            directionality="directed",
            src_display_name="Orders",
            dst_display_name="Customer",
            description="Customer owns orders",
        )
        | changes
    )


def _instance(**changes):
    return dict(rid=f"ont.{T}.lnk.customer_orders.1", link_type_rid=LINK, src=C1, dst=O1) | changes


def _create_type(client):
    response = client.post(f"{BASE}/link-types", json=_definition())
    assert response.status_code == 200, response.text


def test_valid_relationship_and_replay_preserve_dto(client, repo):
    _create_type(client)
    response = client.post(f"{BASE}/link-instances", json=_instance())
    assert response.status_code == 200, response.text
    assert response.json()["src"] == C1
    assert response.json()["dst"] == O1
    assert response.json()["link_type_rid"] == LINK
    assert client.post(f"{BASE}/link-instances", json=_instance()).status_code == 200
    assert len(repo.list_link_instances()) == 1


@pytest.mark.parametrize("field", ["src", "dst"])
def test_definition_rejects_cross_tenant_endpoints(client, repo, field):
    response = client.post(
        f"{BASE}/link-types", json=_definition(**{field: "ont.other.obj.foreign"})
    )
    assert response.status_code == 403, response.text
    assert repo.list_link_types() == []


@pytest.mark.parametrize("field", ["src", "dst"])
def test_definition_requires_existing_endpoints(client, repo, field):
    response = client.post(
        f"{BASE}/link-types", json=_definition(**{field: f"ont.{T}.obj.missing"})
    )
    assert response.status_code == 404, response.text
    assert repo.list_link_types() == []


@pytest.mark.parametrize("field,value", [("cardinality", "many"), ("directionality", "out")])
def test_invalid_definition_enums_are_readable_422(client, field, value):
    response = client.post(f"{BASE}/link-types", json=_definition(**{field: value}))
    assert response.status_code == 422, response.text
    assert response.json()["detail"]


@pytest.mark.parametrize("field", ["src", "dst"])
def test_instance_rejects_cross_tenant_endpoints(client, repo, field):
    _create_type(client)
    response = client.post(
        f"{BASE}/link-instances", json=_instance(**{field: "ont.other.ind.foreign.1"})
    )
    assert response.status_code == 403, response.text
    assert repo.list_link_instances() == []


@pytest.mark.parametrize(
    "field,value",
    [
        ("link_type_rid", f"ont.{T}.link.missing"),
        ("src", f"ont.{T}.ind.customer.missing"),
        ("dst", f"ont.{T}.ind.order.missing"),
    ],
)
def test_instance_requires_type_and_endpoints(client, repo, field, value):
    _create_type(client)
    response = client.post(f"{BASE}/link-instances", json=_instance(**{field: value}))
    assert response.status_code == 404, response.text
    assert repo.list_link_instances() == []


@pytest.mark.parametrize("field,value", [("src", O2), ("dst", C2)])
def test_instance_endpoint_class_must_match_definition(client, repo, field, value):
    _create_type(client)
    response = client.post(f"{BASE}/link-instances", json=_instance(**{field: value}))
    assert response.status_code == 422, response.text
    assert repo.list_link_instances() == []


def test_one_order_cannot_belong_to_two_customers(client, repo):
    _create_type(client)
    assert client.post(f"{BASE}/link-instances", json=_instance()).status_code == 200
    response = client.post(
        f"{BASE}/link-instances", json=_instance(rid=f"ont.{T}.lnk.second", src=C2)
    )
    assert response.status_code == 409, response.text
    assert len(repo.list_link_instances()) == 1


@pytest.mark.parametrize(
    "field,value",
    [("src", OTHER), ("dst", OTHER), ("cardinality", "N:N"), ("directionality", "bidirectional")],
)
def test_definition_structure_with_instances_cannot_change(client, repo, field, value):
    _create_type(client)
    assert client.post(f"{BASE}/link-instances", json=_instance()).status_code == 200
    response = client.post(f"{BASE}/link-types", json=_definition(**{field: value}))
    assert response.status_code == 409, response.text
    assert str(getattr(repo.get_link_type(ClassRef(LINK)), field)) == _definition()[field]


def test_definition_names_and_description_can_change_with_instances(client):
    _create_type(client)
    assert client.post(f"{BASE}/link-instances", json=_instance()).status_code == 200
    response = client.post(
        f"{BASE}/link-types",
        json=_definition(
            src_display_name="Purchases", dst_display_name="Buyer", description="Updated"
        ),
    )
    assert response.status_code == 200, response.text
    assert client.get(f"{BASE}/link-types/{LINK}").json()["description"] == "Updated"


def test_unused_definition_structure_can_change(client):
    _create_type(client)
    response = client.post(f"{BASE}/link-types", json=_definition(src=OTHER, cardinality="N:N"))
    assert response.status_code == 200, response.text
    assert response.json()["src"] == OTHER


def test_self_link_is_readable_422(client):
    _create_type(client)
    response = client.post(f"{BASE}/link-instances", json=_instance(dst=C1))
    assert response.status_code == 422, response.text
    assert response.json()["detail"]


@pytest.mark.parametrize(
    "path,payload", [("link-types", _definition()), ("link-instances", _instance())]
)
def test_relationship_write_requires_authenticated_write_scope(client, auth_headers, path, payload):
    claims = jwt.decode(
        auth_headers["Authorization"].split()[1], options={"verify_signature": False}
    )
    claims["scope"] = "platform.read"
    headers = {"Authorization": "Bearer " + jwt.encode(claims, "test-secret", algorithm="HS256")}
    assert client.post(f"{BASE}/{path}", json=payload, headers=headers).status_code == 403


def test_relationship_write_requires_authentication(client):
    assert (
        client.post(
            f"{BASE}/link-types", json=_definition(), headers={"Authorization": ""}
        ).status_code
        == 401
    )


def test_pg_description_update_survives_new_repository():
    """No default DSN: writes are limited to an explicit disposable MP11 DB."""
    dsn = os.environ.get("MP11_RELATIONSHIP_PG_DSN")
    if not dsn:
        pytest.fail(
            "Set MP11_RELATIONSHIP_PG_DSN to a disposable codex_mp11_* database", pytrace=False
        )
    target = urlparse(dsn)
    assert target.hostname in {"127.0.0.1", "localhost"}
    assert target.port and target.port != 5432
    assert target.path.startswith("/codex_mp11_")
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    repo = PgOntologyRepository(dsn=dsn)
    original = LinkType(
        rid=ClassRef(LINK),
        src=ClassRef(CUSTOMER),
        dst=ClassRef(ORDER),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
        description="Original description",
    )
    with repo.tenant_scope(T):
        repo.upsert_link_type(original)
        assert repo.get_link_type(ClassRef(LINK)).description == "Original description"
        repo.upsert_link_type(replace(original, description="Updated persistent description"))
    reread = PgOntologyRepository(dsn=dsn)
    with reread.tenant_scope(T):
        assert reread.get_link_type(ClassRef(LINK)).description == "Updated persistent description"


def test_pg_concurrent_definition_update_cannot_break_an_inflight_instance(monkeypatch):
    dsn = os.environ.get("MP11_RELATIONSHIP_PG_DSN")
    if not dsn:
        pytest.fail(
            "Set MP11_RELATIONSHIP_PG_DSN to a disposable codex_mp11_* database", pytrace=False
        )
    target = urlparse(dsn)
    assert target.hostname in {"127.0.0.1", "localhost"}
    assert target.port and target.port != 5432
    assert target.path.startswith("/codex_mp11_")
    from uuid import uuid4

    from mate_kernel.ontology import LinkInstance
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    writer = PgOntologyRepository(dsn=dsn)
    updater = PgOntologyRepository(dsn=dsn)
    link = f"ont.{T}.link.race.{uuid4().hex}"
    definition = LinkType(
        rid=ClassRef(link),
        src=ClassRef(CUSTOMER),
        dst=ClassRef(ORDER),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
    )
    with writer.tenant_scope(T):
        _seed(writer)
        writer.upsert_link_type(definition)
    updater._ensure_schema()
    checked, commit, update_started, update_finished = (threading.Event() for _ in range(4))
    check = writer._check_link_cardinality

    def pause_after_check(*args, **kwargs):
        check(*args, **kwargs)
        checked.set()
        assert commit.wait(5), "test did not release instance write"

    monkeypatch.setattr(writer, "_check_link_cardinality", pause_after_check)

    def create():
        with writer.tenant_scope(T):
            return writer.create_link_instance(
                LinkInstance(
                    rid=f"ont.{T}.lnk.race.{uuid4().hex}",
                    link_type_rid=ClassRef(link),
                    src=C1,
                    dst=O1,
                    props=(),
                    tenant_id=T,
                    created_at=datetime.now(UTC),
                )
            )

    def update():
        update_started.set()
        try:
            with updater.tenant_scope(T):
                updater.upsert_link_type(replace(definition, dst=ClassRef(OTHER)))
        except ValueError as e:
            return str(e)
        finally:
            update_finished.set()
        return "silently changed definition"

    with ThreadPoolExecutor(max_workers=2) as pool:
        creating = pool.submit(create)
        try:
            assert checked.wait(5)
            updating = pool.submit(update)
            assert update_started.wait(5)
            update_finished.wait(0.3)  # Give the competing real connection the open write window.
        finally:
            commit.set()
        creating.result(timeout=5)
        outcome = updating.result(timeout=5)
    assert "link instances" in outcome, outcome
    with updater.tenant_scope(T):
        assert updater.get_link_type(ClassRef(link)).dst == ClassRef(ORDER)


def test_pg_instance_revalidates_endpoint_classes_after_definition_commits(monkeypatch):
    dsn = os.environ.get("MP11_RELATIONSHIP_PG_DSN")
    if not dsn:
        pytest.fail(
            "Set MP11_RELATIONSHIP_PG_DSN to a disposable codex_mp11_* database", pytrace=False
        )
    target = urlparse(dsn)
    assert target.hostname in {"127.0.0.1", "localhost"}
    assert target.port and target.port != 5432
    assert target.path.startswith("/codex_mp11_")
    from uuid import uuid4

    from mate_kernel.ontology import LinkInstance
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    updater = PgOntologyRepository(dsn=dsn)
    writer = PgOntologyRepository(dsn=dsn)
    link = f"ont.{T}.link.reverse_race.{uuid4().hex}"
    definition = LinkType(
        rid=ClassRef(link),
        src=ClassRef(CUSTOMER),
        dst=ClassRef(ORDER),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
    )
    with updater.tenant_scope(T):
        _seed(updater)
        updater.upsert_link_type(definition)
    writer._ensure_schema()
    written, commit, create_started, create_finished = (threading.Event() for _ in range(4))
    cursor = updater._cursor

    class PauseAfterDefinitionWrite:
        def __init__(self, real):
            self.real = real

        def __getattr__(self, name):
            return getattr(self.real, name)

        def execute(self, sql, args=None):
            result = self.real.execute(sql, args)
            if "INSERT INTO ont_link_type" in sql:
                written.set()
                assert commit.wait(5), "test did not release definition write"
            return result

    @contextmanager
    def pause_cursor(conn):
        with cursor(conn) as cur:
            yield PauseAfterDefinitionWrite(cur)

    monkeypatch.setattr(updater, "_cursor", pause_cursor)

    def update():
        with updater.tenant_scope(T):
            return updater.upsert_link_type(replace(definition, dst=ClassRef(OTHER)))

    def create():
        create_started.set()
        try:
            with writer.tenant_scope(T):
                writer.create_link_instance(
                    LinkInstance(
                        rid=f"ont.{T}.lnk.reverse_race.{uuid4().hex}",
                        link_type_rid=ClassRef(link),
                        src=C1,
                        dst=O1,
                        props=(),
                        tenant_id=T,
                        created_at=datetime.now(UTC),
                    )
                )
        except ValueError as e:
            return str(e)
        finally:
            create_finished.set()
        return "silently wrote mismatched instance"

    with ThreadPoolExecutor(max_workers=2) as pool:
        updating = pool.submit(update)
        try:
            assert written.wait(5)
            creating = pool.submit(create)
            assert create_started.wait(5)
            create_finished.wait(0.3)
        finally:
            commit.set()
        updating.result(timeout=5)
        outcome = creating.result(timeout=5)
    assert "class_rid" in outcome, outcome
    with writer.tenant_scope(T):
        assert writer.list_link_instances(tenant_id=T, link_type_rid=link) == []


@pytest.fixture
def pg_http_pair(auth_headers):
    dsn = os.environ.get("MP11_RELATIONSHIP_PG_DSN")
    if not dsn:
        pytest.fail(
            "Set MP11_RELATIONSHIP_PG_DSN to a disposable codex_mp11_* database", pytrace=False
        )
    target = urlparse(dsn)
    assert target.hostname in {"127.0.0.1", "localhost"}
    assert target.port and target.port != 5432
    assert target.path.startswith("/codex_mp11_")
    from uuid import uuid4

    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    writer, deleter = PgOntologyRepository(dsn=dsn), PgOntologyRepository(dsn=dsn)
    link = f"ont.{T}.link.endpoint_lifetime.{uuid4().hex}"
    with writer.tenant_scope(T):
        _seed(writer)
        writer.upsert_link_type(
            LinkType(
                rid=ClassRef(link),
                src=ClassRef(CUSTOMER),
                dst=ClassRef(ORDER),
                cardinality=Cardinality.ONE_TO_MANY,
                directionality=Directionality.DIRECTED,
            )
        )
    deleter._ensure_schema()
    app = FastAPI()
    install_auth(app)
    app.include_router(router)
    app.state.kernel_repo = writer
    with TestClient(app, headers=auth_headers, raise_server_exceptions=False) as client:
        yield (
            writer,
            deleter,
            client,
            _instance(link_type_rid=link, rid=f"ont.{T}.lnk.endpoint_lifetime.{uuid4().hex}"),
        )


def test_pg_http_rejects_endpoint_deleted_after_api_reads(pg_http_pair, monkeypatch):
    writer, deleter, client, payload = pg_http_pair
    api_read, proceed = threading.Event(), threading.Event()
    create = writer.create_link_instance

    def pause_before_transaction(*args, **kwargs):
        api_read.set()
        assert proceed.wait(5)
        return create(*args, **kwargs)

    monkeypatch.setattr(writer, "create_link_instance", pause_before_transaction)
    with ThreadPoolExecutor(max_workers=1) as pool:
        creating = pool.submit(client.post, f"{BASE}/link-instances", json=payload)
        try:
            assert api_read.wait(5)
            with deleter.tenant_scope(T):
                assert deleter.delete_individual(O1)
        finally:
            proceed.set()
        response = creating.result(timeout=5)
    assert response.status_code == 404, response.text
    assert "not found" in response.json()["detail"]
    with writer.tenant_scope(T):
        assert writer.list_link_instances(tenant_id=T, link_type_rid=payload["link_type_rid"]) == []


def test_pg_delete_waits_before_cascade_scan_for_validated_http_write(pg_http_pair, monkeypatch):
    writer, deleter, client, payload = pg_http_pair
    validated, proceed, delete_started, delete_finished = (threading.Event() for _ in range(4))
    check = writer._check_link_cardinality

    def pause_after_endpoint_validation(*args, **kwargs):
        check(*args, **kwargs)
        validated.set()
        assert proceed.wait(5)

    monkeypatch.setattr(writer, "_check_link_cardinality", pause_after_endpoint_validation)

    def delete():
        delete_started.set()
        try:
            with deleter.tenant_scope(T):
                return deleter.delete_individual(O1)
        finally:
            delete_finished.set()

    with ThreadPoolExecutor(max_workers=2) as pool:
        creating = pool.submit(client.post, f"{BASE}/link-instances", json=payload)
        try:
            assert validated.wait(5)
            deleting = pool.submit(delete)
            assert delete_started.wait(5)
            # The real delete must wait before scanning links, so it sees the new edge after commit.
            blocked = not delete_finished.wait(0.3)
        finally:
            proceed.set()
        response = creating.result(timeout=5)
        assert deleting.result(timeout=5)
    assert blocked, "deletion scanned/cascaded before the in-flight link write committed"
    assert response.status_code == 200, response.text
    with writer.tenant_scope(T):
        with pytest.raises(KeyError):
            writer.get_individual(O1)
        assert writer.list_link_instances(tenant_id=T, link_type_rid=payload["link_type_rid"]) == []


def test_in_memory_strict_write_requires_materialized_endpoints(repo):
    from mate_kernel.ontology import LinkInstance

    repo.upsert_link_type(
        LinkType(
            rid=ClassRef(LINK),
            src=ClassRef(CUSTOMER),
            dst=ClassRef(ORDER),
            cardinality=Cardinality.ONE_TO_MANY,
            directionality=Directionality.DIRECTED,
        )
    )
    repo.delete_individual(O1)
    link = LinkInstance(
        rid=f"ont.{T}.lnk.strict_missing",
        link_type_rid=ClassRef(LINK),
        src=C1,
        dst=O1,
        props=(),
        created_at=datetime.now(UTC),
        tenant_id=T,
    )
    with pytest.raises(KeyError):
        repo.create_link_instance(link, require_endpoints=True)
    assert repo.list_link_instances() == []


def test_create_only_duplicate_definition_is_conflict_and_keeps_original(client, repo):
    first = client.post(f"{BASE}/link-types?create_only=true", json=_definition())
    assert first.status_code == 200, first.text
    response = client.post(
        f"{BASE}/link-types?create_only=true",
        json=_definition(description="Must not replace original", src_display_name="Changed"),
    )
    assert response.status_code == 409, response.text
    assert repo.get_link_type(ClassRef(LINK)).description == "Customer owns orders"
    assert client.get(f"{BASE}/link-types/{LINK}").json() == first.json()
    assert (
        client.post(f"{BASE}/link-types", json=_definition(description="Explicit edit")).status_code
        == 200
    )
    assert repo.get_link_type(ClassRef(LINK)).description == "Explicit edit"


def test_memory_create_only_is_atomic_for_competing_creators(repo):
    from uuid import uuid4

    link = ClassRef(f"ont.{T}.link.create_only.{uuid4().hex}")
    candidates = [
        LinkType(
            rid=link,
            src=ClassRef(CUSTOMER),
            dst=ClassRef(ORDER),
            cardinality=Cardinality.ONE_TO_MANY,
            directionality=Directionality.DIRECTED,
            description=name,
        )
        for name in ("First", "Second")
    ]
    start = threading.Barrier(2)

    def create(definition):
        start.wait(5)
        try:
            return repo.upsert_link_type(definition, create_only=True).description
        except LinkTypeAlreadyExistsError:
            return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(create, candidates))
    assert results.count("conflict") == 1
    assert repo.get_link_type(link).description in {"First", "Second"}
    assert repo.get_link_type(link).description in results


def test_pg_create_only_concurrent_writes_have_one_winner(pg_http_pair):
    from uuid import uuid4

    writer, competitor, client, _ = pg_http_pair
    link = ClassRef(f"ont.{T}.link.create_only.{uuid4().hex}")
    start = threading.Barrier(2)

    def create(pair):
        repository, description = pair
        start.wait(5)
        with repository.tenant_scope(T):
            try:
                return repository.upsert_link_type(
                    LinkType(
                        rid=link,
                        src=ClassRef(CUSTOMER),
                        dst=ClassRef(ORDER),
                        cardinality=Cardinality.ONE_TO_MANY,
                        directionality=Directionality.DIRECTED,
                        description=description,
                    ),
                    create_only=True,
                ).description
            except LinkTypeAlreadyExistsError:
                return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(create, [(writer, "First"), (competitor, "Second")]))
    assert results.count("conflict") == 1
    with writer.tenant_scope(T):
        assert writer.get_link_type(link).description in results


def test_pg_http_create_only_refuses_rid_claimed_after_catalog_read(pg_http_pair):
    from uuid import uuid4

    writer, competitor, client, _ = pg_http_pair
    rid = f"ont.{T}.link.catalog_race.{uuid4().hex}"
    catalog = client.get(f"{BASE}/link-types").json()
    assert rid not in {row["rid"] for row in catalog}
    original = LinkType(
        rid=ClassRef(rid),
        src=ClassRef(CUSTOMER),
        dst=ClassRef(ORDER),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
        description="Other session won",
    )
    with competitor.tenant_scope(T):
        competitor.upsert_link_type(original, create_only=True)
    snapshot = client.get(f"{BASE}/link-types/{rid}").json()
    response = client.post(
        f"{BASE}/link-types?create_only=true",
        json=_definition(rid=rid, description="Stale create must not overwrite"),
    )
    assert response.status_code == 409, response.text
    assert client.get(f"{BASE}/link-types/{rid}").json() == snapshot
    with writer.tenant_scope(T):
        assert writer.get_link_type(ClassRef(rid)).description == "Other session won"
    assert (
        client.post(
            f"{BASE}/link-types", json=_definition(rid=rid, description="Explicit edit")
        ).status_code
        == 200
    )
    with writer.tenant_scope(T):
        assert writer.get_link_type(ClassRef(rid)).description == "Explicit edit"


@pytest.fixture(params=["memory", "postgres"])
def inherited_client(request, auth_headers):
    if request.param == "postgres":
        from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

        dsn = os.environ.get("MP11_RELATIONSHIP_PG_DSN")
        if not dsn:
            pytest.fail("Required independent MP11_RELATIONSHIP_PG_DSN", pytrace=False)
        repo = PgOntologyRepository(dsn=dsn)
    else:
        repo = InMemoryOntologyRepository()
    key = uuid4().hex
    source, target = f"ont.{T}.obj.child-{key}", f"ont.{T}.obj.leaf-{key}"
    child_instance, leaf_instance = f"ont.{T}.ind.child.{key}", f"ont.{T}.ind.leaf.{key}"
    with repo.tenant_scope(T) if request.param == "postgres" else nullcontext():
        _seed(repo)
        repo.upsert_object_type(
            replace(
                repo.get_object_type(ClassRef(CUSTOMER)),
                rid=ClassRef(source),
                parent_class=ClassRef(CUSTOMER),
            )
        )
        repo.upsert_object_type(
            replace(
                repo.get_object_type(ClassRef(source)),
                rid=ClassRef(target),
                parent_class=ClassRef(source),
            )
        )
        repo.create_individual(
            replace(
                repo.get_individual(C1),
                rid=child_instance,
                class_rid=ClassRef(source),
                primary_key=key,
            )
        )
        repo.create_individual(
            replace(
                repo.get_individual(C1),
                rid=leaf_instance,
                class_rid=ClassRef(target),
                primary_key=key + "leaf",
            )
        )
    app = FastAPI()
    install_auth(app)
    app.include_router(router)
    app.state.kernel_repo = repo
    with TestClient(app, headers=auth_headers, raise_server_exceptions=False) as client:
        yield client, repo, source, target, child_instance, leaf_instance, key


def test_two_sided_transitive_inheritance_replay_inspection_and_query(inherited_client):
    client, repo, child, leaf, child_i, leaf_i, key = inherited_client
    link = f"ont.{T}.link.inherited-{key}"
    # Both endpoints are declared on the ancestor; distinct descendant instances are valid.
    response = client.post(BASE + "/link-types", json=_definition(rid=link, dst=CUSTOMER))
    assert response.status_code == 200, response.text
    payload = _instance(
        rid=f"ont.{T}.lnk.inherited-{key}", link_type_rid=link, src=child_i, dst=leaf_i
    )
    response = client.post(BASE + "/link-instances", json=payload)
    assert response.status_code == 200, response.text
    assert client.post(BASE + "/link-instances", json=payload).status_code == 200
    links = client.get(BASE + "/link-instances", params={"link_type_rid": link}).json()
    assert any(item["rid"] == payload["rid"] for item in links)
    inspected = client.get(BASE + f"/classes/{leaf}/inspect")
    assert inspected.status_code == 200, inspected.text
    applicable = [item for item in inspected.json()["links"] if item["link_type"] == link]
    assert {item["direction"] for item in applicable} == {"in", "out"}
    assert all(item["inherited_from"] == CUSTOMER for item in applicable)
    queried = client.get(BASE + "/individuals", params={"class_rid": CUSTOMER}).json()
    assert {child_i, leaf_i} <= {item["rid"] for item in queried}
    # A second source cannot claim this same target under the original 1:N constraint.
    rejected = client.post(
        BASE + "/link-instances", json={**payload, "rid": payload["rid"] + "other", "src": C2}
    )
    assert rejected.status_code == 409, rejected.text


def test_inheritance_is_directional_and_does_not_accept_unrelated_types(inherited_client):
    client, repo, child, leaf, child_i, leaf_i, key = inherited_client
    link = f"ont.{T}.link.child-only-{key}"
    assert (
        client.post(BASE + "/link-types", json=_definition(rid=link, src=child)).status_code == 200
    )
    payload = _instance(rid=f"ont.{T}.lnk.child-only-{key}", link_type_rid=link)
    assert client.post(BASE + "/link-instances", json=payload).status_code == 422
    assert client.post(BASE + "/link-instances", json={**payload, "src": O1}).status_code == 422
    assert (
        client.post(
            BASE + "/link-instances", json={**payload, "src": "ont.other.ind.child.1"}
        ).status_code
        == 403
    )
    response = client.post(BASE + "/link-instances", json={**payload, "src": leaf_i})
    assert response.status_code == 200, response.text


def test_pg_inherited_link_write_and_child_supersession_do_not_deadlock(monkeypatch):
    """A schema publication cannot invert child-class and endpoint row locks."""
    dsn = os.environ.get("MP11_RELATIONSHIP_PG_DSN")
    if not dsn:
        pytest.fail("Required independent MP11_RELATIONSHIP_PG_DSN", pytrace=False)
    target = urlparse(dsn)
    assert target.hostname in {"127.0.0.1", "localhost"}
    assert target.port and target.port != 5432
    assert target.path.startswith("/codex_mp11_")
    from mate_kernel.ontology import LinkInstance
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    writer = PgOntologyRepository(dsn=dsn)
    updater = PgOntologyRepository(dsn=dsn)
    suffix = uuid4().hex
    old = f"ont.{T}.obj.race-child-{suffix}.v1"
    new = old[:-2] + "v2"
    iid = f"ont.{T}.ind.race-child.{suffix}"
    link = f"ont.{T}.link.race-parent-{suffix}"
    with writer.tenant_scope(T):
        _seed(writer)
        child = replace(
            writer.get_object_type(ClassRef(CUSTOMER)),
            rid=ClassRef(old),
            parent_class=ClassRef(CUSTOMER),
        )
        writer.upsert_object_type(child)
        writer.create_individual(
            replace(writer.get_individual(C1), rid=iid, class_rid=ClassRef(old), primary_key=suffix)
        )
        writer.upsert_link_type(
            LinkType(
                rid=ClassRef(link),
                src=ClassRef(CUSTOMER),
                dst=ClassRef(ORDER),
                cardinality=Cardinality.ONE_TO_MANY,
                directionality=Directionality.DIRECTED,
            )
        )
    updater._ensure_schema()
    checked, proceed, archived = threading.Event(), threading.Event(), threading.Event()
    ancestors = writer._relationship_ancestors
    original_cursor = updater._cursor

    def pause_after_endpoint_lock(cur, class_rid, *, lock=False):
        if class_rid == old and lock:
            checked.set()
            assert proceed.wait(10), "test coordinator did not release the writer"
        return ancestors(cur, class_rid, lock=lock)

    @contextmanager
    def observe_archive(conn):
        with original_cursor(conn) as real:

            class Cursor:
                def execute(self, statement, params=None):
                    result = real.execute(statement, params)
                    if statement.startswith("UPDATE ont_object_type SET archived = TRUE"):
                        archived.set()
                    return result

                def __getattr__(self, name):
                    return getattr(real, name)

            yield Cursor()

    monkeypatch.setattr(writer, "_relationship_ancestors", pause_after_endpoint_lock)
    monkeypatch.setattr(updater, "_cursor", observe_archive)
    instance = LinkInstance(
        rid=f"ont.{T}.lnk.race-parent.{suffix}",
        link_type_rid=ClassRef(link),
        src=iid,
        dst=O1,
        props=(),
        tenant_id=T,
        created_at=datetime.now(UTC),
    )

    def create():
        with writer.tenant_scope(T):
            return writer.create_link_instance(instance, require_endpoints=True)

    def supersede():
        with updater.tenant_scope(T):
            return updater.upsert_object_type(
                replace(child, rid=ClassRef(new)), supersede_rids=[old]
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        creating = pool.submit(create)
        try:
            assert checked.wait(10), "writer did not reach the inherited endpoint validation"
            publishing = pool.submit(supersede)
            archived.wait(2)  # Old lock order reaches archive while holding the schema lock.
        finally:
            proceed.set()
        assert creating.result(timeout=10).rid == instance.rid
        publishing.result(timeout=10)
    with updater.tenant_scope(T):
        assert updater.get_individual(iid).class_rid == ClassRef(new)
        assert any(item.rid == instance.rid for item in updater.list_link_instances(ClassRef(link)))
        assert updater.create_link_instance(instance, require_endpoints=True).rid == instance.rid


def test_pg_usage_reports_zero_then_actual_action_write_count(auth_headers):
    dsn = os.environ.get("MP11_RELATIONSHIP_PG_DSN")
    if not dsn:
        pytest.fail("Required independent MP11_RELATIONSHIP_PG_DSN", pytrace=False)
    target = urlparse(dsn)
    assert target.hostname in {"127.0.0.1", "localhost"}
    assert target.port and target.port != 5432
    assert target.path.startswith("/codex_mp11_")
    from mate_kernel.ontology import ActionType
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    repo = PgOntologyRepository(dsn=dsn)
    suffix = uuid4().hex
    cls = ClassRef(f"ont.{T}.obj.usage-{suffix}")
    iid = f"ont.{T}.ind.usage.{suffix}"
    action = ClassRef(f"ont.{T}.act.usage-{suffix}")
    note = Property(
        rid=ClassRef(f"ont.{T}.prop.note-{suffix}"),
        type_id="string",
        nullable=True,
        primary_key=False,
        title="Note",
        format=PropertyFormat.STRING,
    )
    with repo.tenant_scope(T):
        _seed(repo)
        definition = repo.get_object_type(ClassRef(CUSTOMER))
        repo.upsert_object_type(
            replace(definition, rid=cls, properties=(*definition.properties, note))
        )
        repo.create_individual(
            replace(repo.get_individual(C1), rid=iid, class_rid=cls, primary_key=suffix)
        )
        repo.upsert_action_type(
            ActionType(
                rid=action,
                parameters=(),
                submission_criteria=(),
                side_effects=(),
                function_ref=None,
                on=(cls,),
                declarative_edits=(
                    {
                        "op": "set_property",
                        "target": "$target",
                        "property_rid": note.rid.rid,
                        "value": "written",
                    },
                ),
            )
        )
    app = FastAPI()
    install_auth(app)
    app.include_router(router)
    app.state.kernel_repo = repo
    with TestClient(app, headers=auth_headers, raise_server_exceptions=False) as client:
        read = client.get(BASE + "/individuals", params={"class_rid": cls.rid})
        assert read.status_code == 200, read.text
        usage = client.get(BASE + "/usage/types")
        assert usage.status_code == 200, usage.text
        before = next(row for row in usage.json() if row["class_rid"] == cls.rid)
        assert before["reads"] == 1
        assert before["writes"] == 0
        applied = client.post(
            BASE + f"/action-types/{action.rid}/apply-edit-set",
            json={"target_iid": iid, "impact_summary": "Dedicated synthetic usage regression"},
        )
        assert applied.status_code == 200, applied.text
        after = next(
            row for row in client.get(BASE + "/usage/types").json() if row["class_rid"] == cls.rid
        )
        assert after["reads"] == 1
        assert after["writes"] == 1
    with repo.tenant_scope(T):
        assert repo.get_individual(iid).get(note.rid) == "written"
