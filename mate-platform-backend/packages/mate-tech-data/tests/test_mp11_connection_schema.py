"""MP11 real connector and credential boundary regressions."""

from mate_tech_data import repositories as repo


def test_real_connection_refusal_is_not_saved_connected_status():
    source = repo.create_source(
        "mp11-data",
        "unavailable",
        "postgres",
        {
            "host": "127.0.0.1",
            "port": 1,
            "database": "codex_mp11_source",
            "username": "unavailable",
            "password": "private-test-password",
        },
    )
    result = repo.test_source_connection("mp11-data", source.id)
    assert result["ok"] is False
    assert result["error_code"] == "NETWORK"
    assert result["trace_id"]
    assert "private-test-password" not in str(result)


def test_public_credentials_redacted_and_empty_edit_preserves_secret():
    source = repo.create_source(
        "mp11-data",
        "secure",
        "postgres",
        {
            "host": "localhost",
            "password": "private-test-password",
            "dsn": "postgresql://person:private-test-password@localhost/db",
        },
    )
    assert "private-test-password" not in str(repo.source_to_dict(source))
    updated = repo.update_source(
        "mp11-data",
        source.id,
        connection_config={
            "host": "127.0.0.1",
            "password": "",
            "dsn": "********",
        },
    )
    assert updated.connection_config["password"] == "private-test-password"
    assert updated.connection_config["dsn"] == source.connection_config["dsn"]


def test_csv_discovery_uses_uploaded_columns_and_real_rows():
    source = repo.create_source(
        "mp11-data",
        "orders",
        "csv",
        {
            "csv_content": "order_id,customer_id,total\nO1,C1,12.5\nO2,C1,25\n",
            "table": "orders",
        },
    )
    schema = repo.get_source_schema("mp11-data", source.id)
    assert schema["source_id"] == source.id
    assert schema["discovered_at"] and schema["trace_id"]
    assert [c["name"] for c in schema["tables"][0]["columns"]] == [
        "order_id",
        "customer_id",
        "total",
    ]
    assert repo.test_source_connection("mp11-data", source.id)["ok"] is True


import os
import uuid
from urllib.parse import urlparse

import pytest


@pytest.fixture
def real_pg():
    import psycopg2
    from psycopg2.extensions import parse_dsn

    dsn = os.environ.get("MP11_SOURCE_PG_DSN")
    if not dsn:
        pytest.skip("requires guarded MP11_SOURCE_PG_DSN")
    target = urlparse(dsn)
    assert (
        target.hostname == "127.0.0.1"
        and target.port == 55497
        and target.path.startswith("/codex_mp11_")
    )
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    schema = "source_" + uuid.uuid4().hex[:10]
    role = "mp11_reader_" + uuid.uuid4().hex[:10]
    password = uuid.uuid4().hex
    with conn.cursor() as cur:
        cur.execute(f"CREATE SCHEMA {schema}")
        cur.execute(
            f"CREATE TABLE {schema}.customers (id integer PRIMARY KEY, name text NOT NULL, modified_at timestamptz NOT NULL)"
        )
        cur.execute(
            f"CREATE TABLE {schema}.orders (id integer PRIMARY KEY, customer_id integer NOT NULL, total integer NOT NULL, modified_at timestamptz NOT NULL)"
        )
        cur.execute(f"INSERT INTO {schema}.customers VALUES (1,'Customer One','2026-01-01')")
        cur.execute(
            f"INSERT INTO {schema}.orders VALUES (1,1,10,'2026-01-01'),(2,1,20,'2026-01-01')"
        )
        cur.execute(f"CREATE ROLE {role} LOGIN PASSWORD %s", (password,))
    cfg = parse_dsn(dsn)
    config = {
        "host": cfg["host"],
        "port": int(cfg["port"]),
        "database": cfg["dbname"],
        "username": cfg["user"],
        "password": cfg.get("password"),
        "schema": schema,
    }
    yield conn, config, role, password
    with conn.cursor() as cur:
        cur.execute(f"DROP SCHEMA {schema} CASCADE")
        cur.execute(f"DROP ROLE {role}")
    conn.close()


def test_real_pg_discovery_errors_and_http_credentials(real_pg, client, auth_headers_acme):
    _, config, role, password = real_pg
    base = "/api/v1/data/sources"
    response = client.post(
        base,
        headers=auth_headers_acme,
        json={"name": "PG source", "type": "postgres", "connection_config": config},
    )
    assert response.status_code == 200
    source_id = response.json()["id"]
    assert config["password"] not in response.text
    result = client.get(f"{base}/{source_id}/schema", headers=auth_headers_acme)
    assert result.status_code == 200
    schema = result.json()
    assert schema["discovered_at"] and schema["trace_id"]
    assert {t["name"] for t in schema["tables"]} == {"customers", "orders"}
    assert schema["tables"][0]["columns"][0]["primary_key"] is True
    for changes, code in [
        ({"password": uuid.uuid4().hex}, "AUTHENTICATION"),
        ({"username": role, "password": password}, "PERMISSION"),
        ({"table": "missing"}, "SCHEMA"),
    ]:
        source = repo.create_source("mp11-errors", "failure", "postgres", config | changes)
        result = repo.test_source_connection("mp11-errors", source.id)
        assert result["ok"] is False and result["error_code"] == code
        assert password not in str(result)


def test_backing_declaration_has_registered_source_and_time_columns():
    from mate_tech_ont.v2_kernel.api import BackingDatasourceDTO

    value = BackingDatasourceDTO(
        class_rid="ont.mp11-data.obj.order",
        name="orders",
        table="public.orders",
        pk_column="id",
        source_id="source-1",
        ts_column="modified_at",
        field_mapping={"id": "id"},
    )
    assert value.model_dump()["source_id"] == "source-1"
    assert value.model_dump()["ts_column"] == "modified_at"


def test_real_pg_registered_sync_csv_retry_restart_and_relationships(real_pg, monkeypatch):
    import json
    import subprocess
    import sys

    from mate_tech_data.repositories import sql_models, sql_store
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from mate_kernel.ontology import (
        Cardinality,
        ClassRef,
        Directionality,
        LinkInstance,
        LinkType,
        ObjectType,
        Property,
        PropertyFormat,
    )
    from mate_tech_ont.v2_kernel.backing_datasources import BackingDatasource, preflight
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    conn, config, _, _ = real_pg
    dsn = os.environ["MP11_SOURCE_PG_DSN"]
    engine = create_engine(dsn)
    sql_models.DataSourceORM.__table__.create(engine, checkfirst=True)
    monkeypatch.setattr(sql_store, "_session", sessionmaker(bind=engine))
    monkeypatch.setattr(repo, "get_source", sql_store.get_source)
    tenant = "mp11-" + uuid.uuid4().hex[:10]
    pg = PgOntologyRepository(dsn=dsn)
    pg._ensure_schema()
    source = sql_store.create_source(tenant, "registered", "postgres", config)
    assert repo.get_source_schema(tenant, source.id)["tables"]
    customer = f"ont.{tenant}.obj.customer"
    order = f"ont.{tenant}.obj.order"
    pk = Property(
        rid=ClassRef(f"ont.{tenant}.prop.id"),
        type_id="integer",
        primary_key=True,
        nullable=False,
        title="id",
        format=PropertyFormat.INTEGER,
    )
    total = Property(
        rid=ClassRef(f"ont.{tenant}.prop.total"),
        type_id="integer",
        primary_key=False,
        nullable=False,
        title="total",
        format=PropertyFormat.INTEGER,
    )
    with pg.tenant_scope(tenant):
        for rid, props in ((customer, (pk,)), (order, (pk, total))):
            pg.upsert_object_type(
                ObjectType(
                    rid=ClassRef(rid),
                    primary_key=(pk.rid,),
                    properties=props,
                    interfaces=(),
                    display_name=rid,
                )
            )
        for rid, table, mapping in (
            (customer, "customers", {pk.rid.rid: "id"}),
            (order, "orders", {pk.rid.rid: "id", total.rid.rid: "total"}),
        ):
            decl = {
                "tenant_id": tenant,
                "class_rid": rid,
                "name": table,
                "source_id": source.id,
                "kind": "pg_table",
                "table": f"{config['schema']}.{table}",
                "pk_column": "id",
                "ts_column": "modified_at",
                "field_mapping": mapping,
            }
            pg.upsert_backing_datasource(decl)
        full = pg.sync_backing_datasources(order, batch_limit=1)
        assert full["ok"] and full["total_synced"] == 2, full
        assert full["run_id"] and full["sources"]["orders"]["cursor"]["pk"] == "2"
        assert pg.sync_backing_datasources(customer)["total_synced"] == 1
        assert pg.sync_backing_datasources(order, True)["total_synced"] == 0
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {config['schema']}.orders SET total=11,modified_at='2026-01-02' WHERE id=1"
            )
            cur.execute(f"INSERT INTO {config['schema']}.orders VALUES (3,1,30,'2026-01-02')")
        incremental = pg.sync_backing_datasources(order, True, batch_limit=1)
        assert incremental["ok"] and incremental["total_synced"] == 2, incremental
        # Real source permission/schema failure keeps old cursor and a separate failed run.
        sql_store.update_source(tenant, source.id, connection_config={"table": "missing"})
        failed = pg.sync_backing_datasources(order, True)
        assert not failed["ok"] and failed["status"] == "failed"
        sql_store.update_source(tenant, source.id, connection_config={"table": ""})
        retry = pg.sync_backing_datasources(order, True)
        assert retry["ok"] and retry["total_synced"] == 0
        history = pg.list_backing_datasources(order)[0]["run_history"]
        assert any(r["run_id"] == failed["run_id"] and r["status"] == "failed" for r in history)
        # Unknown columns and cross-tenant source IDs fail before writing.
        with pytest.raises(ValueError, match="Unknown source columns"):
            preflight(
                BackingDatasource(
                    name="bad",
                    source_id=source.id,
                    tenant_id=tenant,
                    table=f"{config['schema']}.orders",
                    pk_column="id",
                    field_mapping={pk.rid.rid: "not_a_column"},
                )
            )
        with pytest.raises(ValueError, match="unavailable in this tenant"):
            preflight(
                BackingDatasource(
                    name="bad",
                    source_id=source.id,
                    tenant_id="other",
                    table="orders",
                    pk_column="id",
                    field_mapping={pk.rid.rid: "id"},
                )
            )
        # Actual target-row failure must not advance beyond the failed key.
        before_cursor = pg.list_backing_datasources(order)[0]["last_synced_pk"]
        with conn.cursor() as cur:
            cur.execute(f"INSERT INTO {config['schema']}.orders VALUES (4,1,44,'2026-01-03')")
            cur.execute(
                f"CREATE FUNCTION {config['schema']}.reject_row() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '{tenant}' AND NEW.primary_key = '4' THEN RAISE EXCEPTION 'injected row failure'; END IF; RETURN NEW; END $$"
            )
            cur.execute(
                f"CREATE TRIGGER mp11_reject_{config['schema']} BEFORE INSERT OR UPDATE ON ont_individual FOR EACH ROW EXECUTE FUNCTION {config['schema']}.reject_row()"
            )
        row_failed = pg.sync_backing_datasources(order, True, batch_limit=1)
        assert not row_failed["ok"] and row_failed["total_failed"] == 1
        assert pg.list_backing_datasources(order)[0]["last_synced_pk"] == before_cursor
        with conn.cursor() as cur:
            cur.execute(f"DROP TRIGGER mp11_reject_{config['schema']} ON ont_individual")
        recovered = pg.sync_backing_datasources(order, True, batch_limit=1)
        assert recovered["ok"] and recovered["total_synced"] == 1
        # Actual CSV batch reuse and replay preserve existing orders.
        csv_source = sql_store.create_source(
            tenant, "batch", "csv", {"csv_content": "id,total\n4,40\n5,50\n", "table": "orders_csv"}
        )
        pg.upsert_backing_datasource(
            {
                "tenant_id": tenant,
                "class_rid": order,
                "name": "csv_batch",
                "kind": "csv",
                "source_id": csv_source.id,
                "table": "orders_csv",
                "pk_column": "id",
                "field_mapping": {pk.rid.rid: "id", total.rid.rid: "total"},
            }
        )
        csv_result = pg.sync_backing_datasources(order)
        assert csv_result["ok"] and csv_result["sources"]["csv_batch"]["synced"] == 2, csv_result
        assert pg.sync_backing_datasources(order)["ok"]
        assert len(pg.list_individuals(ClassRef(order))) == 5
        # Link definition/instance uses the real persistent relationship implementation.
        link = LinkType(
            rid=ClassRef(f"ont.{tenant}.link.customer_orders"),
            src=ClassRef(customer),
            dst=ClassRef(order),
            cardinality=Cardinality.ONE_TO_MANY,
            directionality=Directionality.DIRECTED,
            link_properties=(),
        )
        pg.upsert_link_type(link)
        from datetime import UTC, datetime

        now = datetime.now(UTC)
        li = LinkInstance(
            rid=f"ont.{tenant}.lnk.customer_orders.1",
            link_type_rid=link.rid,
            src=f"ont.{tenant}.ind.customer.1",
            dst=f"ont.{tenant}.ind.order.1",
            props=(),
            created_at=now,
            tenant_id=tenant,
        )
        pg.create_link_instance(li, require_endpoints=True)
        assert len(pg.list_link_instances()) == 1
        # A child process creates a fresh repository and resolves SQL source credentials.
        env = os.environ.copy()
        env["MATE_DB_URL"] = dsn
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env["PYTHONPATH"] = os.pathsep.join(sys.path)
        child = """import os,json
from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository
from mate_kernel.ontology import ClassRef
p=PgOntologyRepository(dsn=os.environ['MP11_SOURCE_PG_DSN'])
with p.tenant_scope(TENANT):
 r=p.sync_backing_datasources(CLASS)
 print(json.dumps({'ok':r['ok'],'count':len(p.list_individuals(ClassRef(CLASS))),'run_id':r['run_id']}))
""".replace("TENANT", repr(tenant)).replace("CLASS", repr(order))
        # Terminate an actual process after its durable 'running' checkpoint.
        import time

        paused_child = child.replace(
            " r=p.sync_backing_datasources",
            " original=p._sync_backing_datasources_once\n p._sync_backing_datasources_once=lambda *a,**kw: (__import__('time').sleep(60), original(*a,**kw))[1]\n r=p.sync_backing_datasources",
        )
        process = subprocess.Popen(
            [sys.executable, "-c", paused_child],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            observed = None
            for _ in range(100):
                newest = pg.list_backing_datasources(order)[0]["run_history"][-1]
                if newest["status"] == "running":
                    observed = newest["run_id"]
                    break
                time.sleep(0.1)
            assert observed, "Child did not persist its running checkpoint"
        finally:
            process.terminate()
            process.communicate(timeout=10)
        completed = subprocess.run(
            [sys.executable, "-c", child], env=env, capture_output=True, text=True, timeout=60
        )
        assert completed.returncode == 0, "Isolated restart child failed"
        actual = json.loads(completed.stdout.strip().splitlines()[-1])
        assert actual["ok"] and actual["count"] == 5
        assert any(
            r["run_id"] == observed and r["status"] == "interrupted"
            for r in pg.list_backing_datasources(order)[0]["run_history"]
        )
        # Exercise retained run lookup through actual authenticated HTTP; cap remains 20.
        import jwt
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from mate_platform.auth import install_auth
        from mate_tech_ont.v2_kernel.api import router

        claims = {
            "sub": "mp11-test",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "scope": "platform.read platform.write",
            "tenant_id": tenant,
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        headers = {
            "Authorization": "Bearer " + jwt.encode(claims, uuid.uuid4().hex, algorithm="HS256")
        }
        app = FastAPI()
        install_auth(app)
        app.include_router(router)
        app.state.kernel_repo = pg
        with TestClient(app, headers=headers) as http:
            failed_lookup = http.get(
                f"/api/v1/ont/v2/object-types/{order}/datasources/runs/{failed['run_id']}"
            )
            assert failed_lookup.status_code == 200 and failed_lookup.json()["status"] == "failed"
            interrupted_lookup = http.get(
                f"/api/v1/ont/v2/object-types/{order}/datasources/runs/{observed}"
            )
            assert (
                interrupted_lookup.status_code == 200
                and interrupted_lookup.json()["status"] == "interrupted"
            )
            oldest = pg.list_backing_datasources(customer)[0]["run_history"][0]["run_id"]
            for _ in range(21):
                latest = pg.sync_backing_datasources(customer, True)
                assert latest["ok"]
            assert len(pg.list_backing_datasources(customer)[0]["run_history"]) == 20
            assert (
                http.get(
                    f"/api/v1/ont/v2/object-types/{customer}/datasources/runs/{oldest}"
                ).status_code
                == 404
            )
            assert (
                http.get(
                    f"/api/v1/ont/v2/object-types/{customer}/datasources/runs/{latest['run_id']}"
                ).status_code
                == 200
            )
        # Changing an actual mapping resets the incompatible old incremental checkpoint.
        changed = pg.list_backing_datasources(customer)[0]
        changed["table"] = changed["table_name"]
        changed["field_mapping"] = {pk.rid.rid: "id"}
        changed["ts_column"] = ""
        pg.upsert_backing_datasource(changed)
        reset = pg.list_backing_datasources(customer)[0]
        assert reset["last_synced_at"] is None and reset["last_synced_pk"] is None

    engine.dispose()


def test_fresh_schema_and_old_backing_schema_upgrade(real_pg):
    import psycopg2
    from psycopg2.extensions import make_dsn, parse_dsn

    from mate_tech_ont.v2_kernel.backing_datasources import BackingDatasource, _connect_source
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    cfg = parse_dsn(os.environ["MP11_SOURCE_PG_DSN"])
    database = "codex_mp11_upgrade_" + uuid.uuid4().hex[:10]
    admin = psycopg2.connect(**(cfg | {"dbname": "postgres"}))
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(f"CREATE DATABASE {database}")
    target = make_dsn(**(cfg | {"dbname": database}))
    try:
        fresh = PgOntologyRepository(dsn=target)
        fresh._ensure_schema()
        conn = psycopg2.connect(target)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name='ont_backing_datasource'"
            )
            assert {"source_id", "run_history", "ts_column"} <= {r[0] for r in cur.fetchall()}
            # Simulate the exact previously deployed table shape before reinitialization.
            cur.execute(
                "ALTER TABLE ont_backing_datasource DROP COLUMN source_id, DROP COLUMN run_history"
            )
        conn.commit()
        conn.close()
        upgraded = PgOntologyRepository(dsn=target)
        upgraded._ensure_schema()
        conn = psycopg2.connect(target)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name='ont_backing_datasource'"
            )
            assert {"source_id", "run_history", "ts_column"} <= {r[0] for r in cur.fetchall()}
        conn.close()
        # Existing environment-backed sources still resolve without a registered source.
        os.environ["MP11_LEGACY_SOURCE_DSN"] = target
        legacy = _connect_source(
            BackingDatasource(
                name="legacy",
                dsn_env="MP11_LEGACY_SOURCE_DSN",
                table="legacy_table",
                pk_column="id",
                field_mapping={"id": "id"},
            )
        )
        legacy.close()
    finally:
        os.environ.pop("MP11_LEGACY_SOURCE_DSN", None)
        with admin.cursor() as cur:
            cur.execute(f"DROP DATABASE {database} WITH (FORCE)")
        admin.close()


def test_incomplete_connection_never_falls_back_to_machine_pg_defaults(monkeypatch):
    import psycopg2

    calls = []

    def forbidden(**kwargs):
        calls.append(kwargs)
        raise RuntimeError("blocked default connection")

    monkeypatch.setattr(psycopg2, "connect", forbidden)
    source = repo.create_source("mp11-safe", "incomplete", "postgres", {})
    result = repo.test_source_connection("mp11-safe", source.id)
    assert calls == []
    assert not result["ok"] and result["error_code"] == "SCHEMA"
