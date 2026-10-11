"""MP11 writes use the real FastAPI router, auth and repositories."""

from __future__ import annotations

import os
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import replace
from datetime import UTC, datetime
from urllib.parse import urlparse

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
        pytest.skip("Set MP11_RELATIONSHIP_PG_DSN to a disposable codex_mp11_* database")
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
        pytest.skip("Set MP11_RELATIONSHIP_PG_DSN to a disposable codex_mp11_* database")
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
        pytest.skip("Set MP11_RELATIONSHIP_PG_DSN to a disposable codex_mp11_* database")
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
        pytest.skip("Set MP11_RELATIONSHIP_PG_DSN to a disposable codex_mp11_* database")
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
