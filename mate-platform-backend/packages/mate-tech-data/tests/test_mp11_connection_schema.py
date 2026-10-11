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
 print(json.dumps({'ok':r['ok'],'count':len(p.list_individuals(ClassRef(CLASS))),'run_id':r['run_id'],'identity':all(d['checkpoint_identity'] for d in p.list_backing_datasources(CLASS,internal=True) if d['kind']=='pg_table'),'public_private_field':any('checkpoint_identity' in d for d in p.list_backing_datasources(CLASS))}))
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
        assert actual["identity"] and not actual["public_private_field"]
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
            assert {"source_id", "run_history", "ts_column", "checkpoint_identity"} <= {
                r[0] for r in cur.fetchall()
            }
            # Simulate the exact previously deployed table shape before reinitialization.
            cur.execute(
                "ALTER TABLE ont_backing_datasource DROP COLUMN source_id, DROP COLUMN run_history, DROP COLUMN checkpoint_identity"
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
            assert {"source_id", "run_history", "ts_column", "checkpoint_identity"} <= {
                r[0] for r in cur.fetchall()
            }
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


@pytest.fixture
def mp11_sync_case(real_pg, monkeypatch):
    from types import SimpleNamespace

    from mate_tech_data.repositories import sql_models, sql_store
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from mate_kernel.ontology import ClassRef, ObjectType, Property, PropertyFormat
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    conn, config, _, _ = real_pg
    engine = create_engine(os.environ["MP11_SOURCE_PG_DSN"])
    sql_models.DataSourceORM.__table__.create(engine, checkfirst=True)
    monkeypatch.setattr(sql_store, "_session", sessionmaker(bind=engine))
    monkeypatch.setattr(repo, "get_source", sql_store.get_source)
    tenant = "mp11-fix-" + uuid.uuid4().hex[:8]
    pg = PgOntologyRepository(dsn=os.environ["MP11_SOURCE_PG_DSN"])
    pg._ensure_schema()
    source = sql_store.create_source(tenant, "registered", "postgres", config)
    rid = f"ont.{tenant}.obj.order"
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
    ot = ObjectType(
        rid=ClassRef(rid),
        primary_key=(pk.rid,),
        properties=(pk, total),
        interfaces=(),
        display_name="Orders",
    )
    decl = dict(
        tenant_id=tenant,
        class_rid=rid,
        name="orders",
        source_id=source.id,
        kind="pg_table",
        table=f"{config['schema']}.orders",
        pk_column="id",
        ts_column="modified_at",
        field_mapping={pk.rid.rid: "id", total.rid.rid: "total"},
    )
    with pg.tenant_scope(tenant):
        pg.upsert_object_type(ot)
        pg.upsert_backing_datasource(decl)
        yield SimpleNamespace(
            pg=pg,
            source=source,
            tenant=tenant,
            rid=rid,
            ot=ot,
            decl=decl,
            sql=sql_store,
            conn=conn,
            config=config,
            pk=pk,
            total=total,
        )
    engine.dispose()


@pytest.fixture
def mp11_retarget_db(mp11_sync_case):
    import psycopg2
    from psycopg2.extensions import make_dsn, parse_dsn

    c = mp11_sync_case
    database = "codex_mp11_retarget_" + uuid.uuid4().hex[:8]
    with c.conn.cursor() as q:
        q.execute(f"CREATE DATABASE {database}")
    cfg = parse_dsn(os.environ["MP11_SOURCE_PG_DSN"])
    other_dsn = make_dsn(**(cfg | {"dbname": database}))
    other = psycopg2.connect(other_dsn)
    other.autocommit = True
    try:
        with other.cursor() as q:
            q.execute(f"CREATE SCHEMA {c.config['schema']}")
            q.execute(
                f"CREATE TABLE {c.config['schema']}.orders (id integer PRIMARY KEY,total integer NOT NULL,modified_at timestamptz NOT NULL)"
            )
            q.execute(f"INSERT INTO {c.config['schema']}.orders VALUES (21,210,'2020-01-01')")
            q.execute(
                "CREATE TABLE public.orders (id integer PRIMARY KEY,total integer NOT NULL,modified_at timestamptz NOT NULL)"
            )
            q.execute("INSERT INTO public.orders VALUES (99,990,'2020-01-01')")
        yield database, other_dsn
    finally:
        other.close()
        with c.conn.cursor() as q:
            q.execute(f"DROP DATABASE {database} WITH (FORCE)")


def test_fix_i1_same_registered_source_retarget_restarts_older_dataset(
    mp11_sync_case, mp11_retarget_db
):
    c = mp11_sync_case
    database, _ = mp11_retarget_db
    assert c.pg.sync_backing_datasources(c.rid)["total_synced"] == 2
    c.sql.update_source(c.tenant, c.source.id, connection_config={"database": database})
    result = c.pg.sync_backing_datasources(c.rid, True)
    assert result["ok"] and result["total_synced"] == 1, result
    assert {str(i.primary_key) for i in c.pg.list_individuals(c.ot.rid)} == {"1", "2", "21"}


def test_fix_i1_legacy_env_retarget_restarts_older_dataset(
    mp11_sync_case, mp11_retarget_db, monkeypatch
):
    c = mp11_sync_case
    _, other_dsn = mp11_retarget_db
    monkeypatch.setenv("MP11_FIX_LEGACY", os.environ["MP11_SOURCE_PG_DSN"])
    decl = c.decl | {"source_id": None, "dsn_env": "MP11_FIX_LEGACY"}
    c.pg.upsert_backing_datasource(decl)
    assert c.pg.sync_backing_datasources(c.rid)["total_synced"] == 2
    monkeypatch.setenv("MP11_FIX_LEGACY", other_dsn)
    result = c.pg.sync_backing_datasources(c.rid, True)
    assert result["ok"] and result["total_synced"] == 1, result


def test_fix_i1_mapping_edit_rejected_while_sync_owns_lock(mp11_sync_case, monkeypatch):
    c = mp11_sync_case
    original = c.pg._sync_backing_datasources_once

    def during(*args, **kwargs):
        with pytest.raises(ValueError, match=r"sync.*running"):
            c.pg.upsert_backing_datasource(c.decl | {"ts_column": ""})
        return original(*args, **kwargs)

    monkeypatch.setattr(c.pg, "_sync_backing_datasources_once", during)
    result = c.pg.sync_backing_datasources(c.rid)
    assert result["ok"], result
    assert c.pg.list_backing_datasources(c.rid)[0]["ts_column"] == "modified_at"


@pytest.mark.parametrize("edit_before_read", [False, True])
def test_fix_i1_source_edit_during_run_never_restores_old_checkpoint(
    mp11_sync_case, mp11_retarget_db, monkeypatch, edit_before_read
):
    c = mp11_sync_case
    database, _ = mp11_retarget_db
    from mate_tech_ont.v2_kernel import backing_datasources as backing

    original = backing.sync_backing_datasource

    def edit_after_read(*args, **kwargs):
        if edit_before_read:
            c.sql.update_source(c.tenant, c.source.id, connection_config={"database": database})
        result = original(*args, **kwargs)
        if not edit_before_read:
            c.sql.update_source(c.tenant, c.source.id, connection_config={"database": database})
        return result

    with monkeypatch.context() as scoped:
        scoped.setattr(backing, "sync_backing_datasource", edit_after_read)
        result = c.pg.sync_backing_datasources(c.rid)
    declaration = c.pg.list_backing_datasources(c.rid)[0]
    assert not result["ok"] and result["status"] == "failed", result
    assert result["total_synced"] == 2 and result["total_failed"] == 1
    assert {str(i.primary_key) for i in c.pg.list_individuals(c.ot.rid)} == {"1", "2"}
    assert declaration["last_synced_at"] is None and declaration["last_synced_pk"] is None
    resumed = c.pg.sync_backing_datasources(c.rid, True)
    assert resumed["ok"] and resumed["total_synced"] == 1, resumed


def test_fix_i2_recovery_rereads_after_lock_and_preserves_terminal_history(
    mp11_sync_case, monkeypatch
):
    import json

    c = mp11_sync_case
    running = dict(
        run_id="interleaved",
        trace_id="trace",
        status="running",
        started_at="2026-01-01T00:00:00+00:00",
        ended_at=None,
        incremental=False,
    )
    terminal = running | dict(
        status="failed",
        ended_at="2026-01-01T00:00:01+00:00",
        total_synced=7,
        total_failed=1,
        error={"message": "original terminal error"},
    )
    newest = running | dict(
        run_id="newer", status="succeeded", total_synced=9, ended_at="2026-01-01T00:00:02+00:00"
    )
    c.pg._record_backing_run(c.rid, c.tenant, running, begin=True)
    factory = c.pg._cursor
    fired = False

    class Interleave:
        def __init__(self, cur):
            self.cur = cur

        def __enter__(self):
            self.cur.__enter__()
            return self

        def __exit__(self, *a):
            return self.cur.__exit__(*a)

        def __getattr__(self, n):
            return getattr(self.cur, n)

        def execute(self, query, params=None):
            nonlocal fired
            if "pg_try_advisory_lock" in str(query) and not fired:
                fired = True
                with c.conn.cursor() as q:
                    q.execute(
                        "UPDATE ont_backing_datasource SET run_history=%s::jsonb WHERE tenant_id=%s AND class_rid=%s",
                        (json.dumps([terminal, newest]), c.tenant, c.rid),
                    )
            return self.cur.execute(query, params)

    monkeypatch.setattr(c.pg, "_cursor", lambda conn: Interleave(factory(conn)))
    history = c.pg.list_backing_datasources(c.rid)[0]["run_history"]
    assert fired and history == [terminal, newest], history


def test_fix_i2_active_owner_and_abandoned_run_recovery(mp11_sync_case):
    c = mp11_sync_case
    running = dict(
        run_id="active",
        trace_id="trace",
        status="running",
        started_at="2026-01-01T00:00:00+00:00",
        ended_at=None,
        incremental=False,
    )
    c.pg._record_backing_run(c.rid, c.tenant, running, begin=True)
    key = "sync:" + c.tenant + ":" + c.rid
    with c.conn.cursor() as q:
        q.execute("SELECT pg_advisory_lock(hashtext(%s))", (key,))
    try:
        assert c.pg.list_backing_datasources(c.rid)[0]["run_history"][-1]["status"] == "running"
    finally:
        with c.conn.cursor() as q:
            q.execute("SELECT pg_advisory_unlock(hashtext(%s))", (key,))
    recovered = c.pg.list_backing_datasources(c.rid)[0]["run_history"][-1]
    assert recovered["run_id"] == "active" and recovered["status"] == "interrupted"


def test_fix_i3_bare_table_rejected_before_conflicting_schema_import(
    mp11_sync_case, mp11_retarget_db
):
    from mate_tech_data.services.source_connector import SourceError

    from mate_tech_ont.v2_kernel.backing_datasources import BackingDatasource, preflight

    c = mp11_sync_case
    database, _ = mp11_retarget_db
    c.sql.update_source(c.tenant, c.source.id, connection_config={"database": database})
    args = {k: v for k, v in c.decl.items() if k not in {"class_rid"}}
    with pytest.raises(SourceError, match="qualified"):
        preflight(BackingDatasource(**(args | {"table": "orders"})), c.ot)
    assert c.pg.list_individuals(c.ot.rid) == []
    result = c.pg.sync_backing_datasources(c.rid)
    assert result["ok"] and result["total_synced"] == 1, result
    assert {str(i.primary_key) for i in c.pg.list_individuals(c.ot.rid)} == {"21"}


def test_fix_i4_normalized_csv_pk_collision_is_zero_write_then_replay(mp11_sync_case):
    from mate_tech_data.services.source_connector import SourceError

    from mate_tech_ont.v2_kernel.backing_datasources import BackingDatasource, preflight

    c = mp11_sync_case
    source = c.sql.create_source(
        c.tenant, "csv", "csv", {"csv_content": "id,total\n01,10\n1,20\n", "table": "orders"}
    )
    decl = c.decl | {"source_id": source.id, "kind": "csv", "table": "orders", "ts_column": None}
    ds = BackingDatasource(**{k: v for k, v in decl.items() if k != "class_rid"})
    with pytest.raises(SourceError, match="normaliz"):
        preflight(ds, c.ot)
    c.pg.upsert_backing_datasource(decl)
    failed = c.pg.sync_backing_datasources(c.rid)
    assert not failed["ok"] and c.pg.list_individuals(c.ot.rid) == []
    c.sql.update_source(
        c.tenant, source.id, connection_config={"csv_content": "id,total\n1,10\n2,20\n"}
    )
    assert c.pg.sync_backing_datasources(c.rid)["total_synced"] == 2
    assert c.pg.sync_backing_datasources(c.rid)["total_synced"] == 2
    assert len(c.pg.list_individuals(c.ot.rid)) == 2


def test_fix_i1_display_and_password_rotation_preserve_checkpoint(mp11_sync_case, real_pg):
    c = mp11_sync_case
    _, _, role, password = real_pg
    with c.conn.cursor() as q:
        q.execute(f"GRANT USAGE ON SCHEMA {c.config['schema']} TO {role}")
        q.execute(f"GRANT SELECT ON ALL TABLES IN SCHEMA {c.config['schema']} TO {role}")
    c.sql.update_source(
        c.tenant, c.source.id, connection_config={"username": role, "password": password}
    )
    assert c.pg.sync_backing_datasources(c.rid)["total_synced"] == 2
    before = c.pg.list_backing_datasources(c.rid, internal=True)[0]["checkpoint_identity"]
    assert before and "checkpoint_identity" not in c.pg.list_backing_datasources(c.rid)[0]
    rotated = uuid.uuid4().hex
    with c.conn.cursor() as q:
        q.execute(f"ALTER ROLE {role} PASSWORD %s", (rotated,))
    c.sql.update_source(
        c.tenant,
        c.source.id,
        name="Harmless renamed source",
        connection_config={"password": rotated},
    )
    result = c.pg.sync_backing_datasources(c.rid, True)
    assert result["ok"] and result["total_synced"] == 0, result
    assert c.pg.list_backing_datasources(c.rid, internal=True)[0]["checkpoint_identity"] == before


def test_fix_i1_busy_mapping_and_sync_http409_preserve_state(mp11_sync_case):
    import time

    import jwt
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from mate_platform.auth import install_auth
    from mate_tech_ont.v2_kernel.api import router

    c = mp11_sync_case
    app = FastAPI()
    install_auth(app)
    app.include_router(router)
    app.state.kernel_repo = c.pg
    now = int(time.time())
    token = jwt.encode(
        {
            "sub": "fix-fixture",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "tenant_id": c.tenant,
            "scope": "platform.read platform.write",
            "iat": now,
            "exp": now + 300,
        },
        uuid.uuid4().hex,
        algorithm="HS256",
    )
    key = "sync:" + c.tenant + ":" + c.rid
    with c.conn.cursor() as q:
        q.execute("SELECT pg_advisory_lock(hashtext(%s))", (key,))
    try:
        with TestClient(app, headers={"Authorization": "Bearer " + token}) as http:
            url = f"/api/v1/ont/v2/object-types/{c.rid}/datasources"
            assert http.post(url, json=c.decl | {"priority": 42}).status_code == 409
            assert http.post(url + "/sync").status_code == 409
            listing = http.get(url)
            assert listing.status_code == 200 and "checkpoint_identity" not in listing.json()[0]
        assert c.pg.list_backing_datasources(c.rid)[0]["priority"] == 100
    finally:
        with c.conn.cursor() as q:
            q.execute("SELECT pg_advisory_unlock(hashtext(%s))", (key,))


def test_fix_i1_legacy_search_path_retarget_resolves_relation(
    mp11_sync_case, mp11_retarget_db, monkeypatch
):
    from psycopg2.extensions import make_dsn, parse_dsn

    c = mp11_sync_case
    _, other_dsn = mp11_retarget_db
    config = parse_dsn(other_dsn)
    monkeypatch.setenv(
        "MP11_FIX_SEARCH", make_dsn(**(config | {"options": "-c search_path=public"}))
    )
    c.pg.upsert_backing_datasource(
        c.decl | {"source_id": None, "dsn_env": "MP11_FIX_SEARCH", "table": "orders"}
    )
    first = c.pg.sync_backing_datasources(c.rid)
    assert first["ok"] and first["total_synced"] == 1, first
    monkeypatch.setenv(
        "MP11_FIX_SEARCH",
        make_dsn(**(config | {"options": "-c search_path=" + c.config["schema"]})),
    )
    result = c.pg.sync_backing_datasources(c.rid, True)
    assert result["ok"] and result["total_synced"] == 1, result
    assert {str(i.primary_key) for i in c.pg.list_individuals(c.ot.rid)} == {"99", "21"}


def test_fix_i3_qualified_dotted_table_keeps_identifier_components(
    mp11_sync_case, mp11_retarget_db
):
    import psycopg2
    from psycopg2 import sql

    c = mp11_sync_case
    database, other_dsn = mp11_retarget_db
    with psycopg2.connect(other_dsn) as other:
        with other.cursor() as q:
            q.execute(
                sql.SQL(
                    "CREATE TABLE {} (id integer PRIMARY KEY,total integer NOT NULL,modified_at timestamptz NOT NULL)"
                ).format(sql.Identifier(c.config["schema"], "orders.detail"))
            )
            q.execute(
                sql.SQL("INSERT INTO {} VALUES (31,310,'2020-01-01')").format(
                    sql.Identifier(c.config["schema"], "orders.detail")
                )
            )
    c.sql.update_source(c.tenant, c.source.id, connection_config={"database": database})
    c.pg.upsert_backing_datasource(c.decl | {"table": c.config["schema"] + ".orders.detail"})
    result = c.pg.sync_backing_datasources(c.rid)
    assert result["ok"] and result["total_synced"] == 1, result
    assert {str(i.primary_key) for i in c.pg.list_individuals(c.ot.rid)} == {"31"}


def test_fix_i1_registered_source_reads_release_sql_session(mp11_sync_case, monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    c = mp11_sync_case
    engine = create_engine(
        os.environ["MP11_SOURCE_PG_DSN"], pool_size=1, max_overflow=0, pool_timeout=0.1
    )
    factory = sessionmaker(bind=engine)
    sessions = []

    def session():
        value = factory()
        sessions.append(value)  # Make lifecycle deterministic instead of relying on GC.
        return value

    monkeypatch.setattr(c.sql, "_session", session)
    try:
        for _ in range(3):
            assert c.sql.get_source(c.tenant, c.source.id).id == c.source.id
        assert engine.pool.checkedout() == 0
        assert c.sql.get_source(c.tenant, "missing-source") is None
        assert c.sql.get_source("another-tenant", c.source.id) is None
        assert engine.pool.checkedout() == 0

        def reject_conversion(_row):
            raise ValueError("synthetic conversion failure")

        monkeypatch.setattr(c.sql, "_orm_to_source", reject_conversion)
        with pytest.raises(ValueError, match="synthetic conversion failure"):
            c.sql.get_source(c.tenant, c.source.id)
        assert engine.pool.checkedout() == 0
    finally:
        for value in sessions:
            value.close()
        engine.dispose()
