"""Exercise the demo's additive upgrade on actual isolated database connections."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import uuid
from contextlib import contextmanager
from pathlib import Path

import pytest
import sqlalchemy as sa
from mate_app_hub.repositories.sql_models import ApphubAppORM, ApphubPageORM

from mate_tech_mcp.repositories.sql_models import McpApiKeyORM

TABLES = {
    table.name: table
    for table in (ApphubAppORM.__table__, ApphubPageORM.__table__, McpApiKeyORM.__table__)
}
ADDITIONS = {
    "apphub_apps": {
        "revision",
        "status",
        "created_at",
        "updated_at",
        "published_version_id",
        "versions",
        "releases",
    },
    "apphub_pages": {"definition"},
    "mcp_api_keys": {"scopes"},
}
KEY_HASH = "7" * 64


def schema_tool():
    name = "demo_schema_upgrade_test_module"
    if name not in sys.modules:
        root = next(p for p in Path(__file__).resolve().parents if (p / "infra").is_dir())
        path = root / "infra/demo-cloud/configure_schema.py"
        spec = importlib.util.spec_from_file_location(name, path)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        try:
            spec.loader.exec_module(module)
        except BaseException:
            sys.modules.pop(name, None)
            raise
    return sys.modules[name]


@pytest.fixture(params=["sqlite", "pg"])
def engine(request, tmp_path):
    if request.param == "sqlite":
        target = sa.create_engine(f"sqlite:///{tmp_path / 'schema-upgrade.db'}")
        try:
            yield target
        finally:
            target.dispose()
        return

    dsn = os.environ.get("MP11_APPHUB_PG_DSN")
    if not dsn:
        pytest.fail("MP11_APPHUB_PG_DSN requires isolated PostgreSQL", pytrace=False)
    url = sa.make_url(dsn)
    assert url.get_backend_name() == "postgresql"
    assert url.host == "127.0.0.1" and url.port == 55497
    assert url.database and url.database.startswith("codex_mp11_")
    assert not any(k in url.query for k in ("host", "hostaddr", "port", "dbname", "service"))
    owner = sa.create_engine(url)
    schema = f"codex_demo_schema_{uuid.uuid4().hex}"
    target = None
    created = False
    try:
        with owner.begin() as connection:
            role = connection.execute(
                sa.text(
                    "SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole "
                    "FROM pg_roles WHERE rolname = current_user"
                )
            ).one()
            assert tuple(role) == (False, False, False, False)
            connection.execute(sa.text(f'CREATE SCHEMA "{schema}" AUTHORIZATION CURRENT_USER'))
            created = True
        target = sa.create_engine(
            url.set(query={**url.query, "options": f"-csearch_path={schema}"})
        )
        with target.connect() as connection:
            assert connection.execute(sa.text("SELECT current_schema()")).scalar_one() == schema
            assert connection.dialect.default_schema_name == schema
        yield target
    finally:
        if target is not None:
            target.dispose()
        if created:
            assert schema.startswith("codex_demo_schema_") and len(schema) == 50
            with owner.begin() as connection:
                connection.execute(sa.text(f'DROP SCHEMA "{schema}" CASCADE'))
        owner.dispose()


def seed_legacy(connection, conflict=None):
    metadata = sa.MetaData()
    legacy = {}
    for name, model in TABLES.items():
        columns = [
            sa.Column(
                c.name,
                c.type,
                primary_key=c.primary_key,
                nullable=c.nullable,
                unique=c.unique,
                index=c.index,
                server_default=c.server_default,
            )
            for c in model.columns
            if c.name not in ADDITIONS[name]
        ]
        if conflict and name == conflict[0]:
            columns.append(
                sa.Column(
                    conflict[1], conflict[2], nullable=conflict[3], server_default=conflict[4]
                )
            )
        legacy[name] = sa.Table(name, metadata, *columns)
        legacy[name].create(connection)
    connection.execute(
        legacy["apphub_apps"]
        .insert()
        .values(
            id="kept-app",
            tenant_id="tenant-kept",
            name="Existing app",
            code="old-app",
            category="work",
            description="untouched",
            version="0.8",
            owner="existing-owner",
            tags="tag-a\ntag-b",
            business_domain="business",
        )
    )
    connection.execute(
        legacy["apphub_pages"]
        .insert()
        .values(
            id="kept-page",
            tenant_id="tenant-kept",
            name="Existing page",
            code="old-page",
            module_code="old-module",
            layout="single",
            schema_version=1,
        )
    )
    scope_value = {}
    if "scopes" in legacy["mcp_api_keys"].columns:
        scope_value["scopes"] = (
            "[]" if isinstance(legacy["mcp_api_keys"].c.scopes.type, sa.Text) else 0
        )
    connection.execute(
        legacy["mcp_api_keys"]
        .insert()
        .values(
            id="kept-key",
            tenant_id="tenant-kept",
            key_name="Existing key",
            key_hash=KEY_HASH,
            key_prefix="sk-mcp-old",
            blocked=False,
            expires_at=None,
            last_active_at=None,
            created_at="2026-10-01",
            created_by="existing-owner",
            **scope_value,
        )
    )
    version = sa.Table("alembic_version", metadata, sa.Column("version_num", sa.String(64)))
    version.create(connection)
    connection.execute(version.insert().values(version_num="0020_mcp_clients"))
    unrelated = sa.Table(
        "untouched_records",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("content", sa.Text, nullable=False),
    )
    unrelated.create(connection)
    connection.execute(unrelated.insert().values(id=1, content="preserve exact bytes"))
    return legacy


def rows(connection):
    return {
        name: [
            dict(row) for row in connection.execute(sa.text(f'SELECT * FROM "{name}"')).mappings()
        ]
        for name in (*TABLES, "alembic_version", "untouched_records")
    }


def column_shape(connection):
    inspector = sa.inspect(connection)
    shapes = {}
    for name in TABLES:
        primary_key = set(inspector.get_pk_constraint(name)["constrained_columns"])
        shapes[name] = [
            (c["name"], str(c["type"]), c["nullable"], c["default"], c["name"] in primary_key)
            for c in inspector.get_columns(name)
        ]
    return shapes


@contextmanager
def mutations(engine):
    statements = []

    def capture(connection, cursor, statement, parameters, context, executemany):
        if statement.lstrip().split()[0].upper() in {
            "ALTER",
            "CREATE",
            "DROP",
            "INSERT",
            "UPDATE",
            "DELETE",
            "TRUNCATE",
        }:
            statements.append(statement)

    sa.event.listen(engine, "before_cursor_execute", capture)
    try:
        yield statements
    finally:
        sa.event.remove(engine, "before_cursor_execute", capture)


def test_legacy_rows_receive_only_safe_defaults_and_retry_has_zero_mutations(engine):
    with engine.begin() as connection:
        legacy = seed_legacy(connection)
        before = rows(connection)
        assert sum(len(ADDITIONS[name] - set(legacy[name].columns.keys())) for name in TABLES) == 9
        changes = schema_tool().upgrade_schema(connection)
        assert changes["created_tables"] == []
        assert {
            name: set(columns) for name, columns in changes["added_columns"].items()
        } == ADDITIONS
        after = rows(connection)
        for name, old_rows in before.items():
            assert [{key: row[key] for key in old_rows[0]} for row in after[name]] == old_rows
        app = after["apphub_apps"][0]
        assert app["revision"] == 0 and app["status"] == "DESIGNING"
        assert app["created_at"] is None and app["updated_at"] is None
        assert app["published_version_id"] is None
        assert json.loads(app["versions"]) == [] and json.loads(app["releases"]) == []
        assert json.loads(after["apphub_pages"][0]["definition"]) == {}
        assert after["mcp_api_keys"][0]["key_hash"] == KEY_HASH
        assert json.loads(after["mcp_api_keys"][0]["scopes"]) == []
        with mutations(engine) as written:
            again = schema_tool().upgrade_schema(connection)
        assert again == {"created_tables": [], "added_columns": {}}
        assert written == []
        assert rows(connection) == after


def test_fresh_database_creates_only_the_three_target_tables(engine):
    with engine.begin() as connection:
        changes = schema_tool().upgrade_schema(connection)
        assert set(changes["created_tables"]) == set(TABLES)
        assert changes["added_columns"] == {}
        assert set(sa.inspect(connection).get_table_names()) == set(TABLES)
        for name, columns in ADDITIONS.items():
            assert columns <= {
                column["name"] for column in sa.inspect(connection).get_columns(name)
            }
        with mutations(engine) as written:
            assert schema_tool().upgrade_schema(connection) == {
                "created_tables": [],
                "added_columns": {},
            }
        assert written == []


def test_existing_scope_column_without_server_default_keeps_legacy_grants_empty(engine):
    with engine.begin() as connection:
        seed_legacy(connection, ("mcp_api_keys", "scopes", sa.Text(), False, None))
        before = rows(connection)
        changes = schema_tool().upgrade_schema(connection)
        assert changes["created_tables"] == []
        assert set(changes["added_columns"]) == {"apphub_apps", "apphub_pages"}
        after = rows(connection)
        assert after["mcp_api_keys"] == before["mcp_api_keys"]
        assert json.loads(after["mcp_api_keys"][0]["scopes"]) == []
        scopes = next(
            c for c in sa.inspect(connection).get_columns("mcp_api_keys") if c["name"] == "scopes"
        )
        assert scopes["default"] is None


@pytest.mark.parametrize(
    "stored,default",
    [
        ("invalid-json", None),
        ("null", None),
        ('["platform.write"]', None),
        ("[]", '["platform.write"]'),
    ],
    ids=["invalid-json", "null-grants", "legacy-grants", "unsafe-default"],
)
def test_unsafe_existing_grants_fail_without_upgrading_or_changing_any_rows(
    engine, stored, default
):
    with engine.begin() as connection:
        legacy = seed_legacy(connection, ("mcp_api_keys", "scopes", sa.Text(), False, default))
        connection.execute(legacy["mcp_api_keys"].update().values(scopes=stored))
        before = rows(connection)
        columns = column_shape(connection)
        tool = schema_tool()
        with mutations(engine) as written:
            with pytest.raises(tool.SchemaUpgradeError, match="mcp_api_keys\\.scopes"):
                tool.upgrade_schema(connection)
        assert written == []
        assert rows(connection) == before
        assert column_shape(connection) == columns


def test_previously_reviewed_grants_with_official_default_are_preserved(engine):
    with engine.begin() as connection:
        legacy = seed_legacy(connection, ("mcp_api_keys", "scopes", sa.Text(), False, "[]"))
        connection.execute(legacy["mcp_api_keys"].update().values(scopes='["platform.read"]'))
        before = rows(connection)
        schema_tool().upgrade_schema(connection)
        assert rows(connection)["mcp_api_keys"] == before["mcp_api_keys"]


def test_fresh_database_preserves_human_issued_grants_on_restart_without_mutations(engine):
    with engine.begin() as connection:
        tool = schema_tool()
        tool.upgrade_schema(connection)
        keys = TABLES["mcp_api_keys"]
        connection.execute(
            keys.insert().values(
                id="reviewed-key",
                tenant_id="tenant-kept",
                key_name="Human-issued read key",
                key_hash=KEY_HASH,
                key_prefix="sk-mcp-reviewed",
                created_by="human-reviewer",
                scopes='["platform.read"]',
            )
        )
        before = [dict(row) for row in connection.execute(sa.select(keys)).mappings()]
        assert json.loads(before[0]["scopes"]) == ["platform.read"]
        assert before[0]["key_hash"] == KEY_HASH
        with mutations(engine) as written:
            assert tool.upgrade_schema(connection) == {"created_tables": [], "added_columns": {}}
        assert written == []
        assert [dict(row) for row in connection.execute(sa.select(keys)).mappings()] == before


@pytest.mark.parametrize(
    "default,allowed",
    [
        ("'[]'", True),
        ("'[]'::text", True),
        ("('[]')", True),
        ("(( '[]'::text ))", True),
        ("( ( '[]' ) )::text", True),
        ("(( '[]' )::text)", True),
        ("(( '[]'::jsonb || '[\"platform.write\"]'::jsonb ))::text", False),
        ("('[]'::text || ' '::text)", False),
        ("coalesce('[]'::text, '[\"platform.write\"]'::text)", False),
        ("'[]'::jsonb", False),
        ("('[]'", False),
        ("'[]')", False),
        ("[]", False),
        ("'[]'::text; SELECT 1", False),
    ],
    ids=[
        "text-literal",
        "text-cast",
        "outer-pair",
        "inner-cast",
        "outer-cast",
        "cast-between-wrappers",
        "json-concat",
        "text-concat",
        "function",
        "json-cast",
        "unbalanced-open",
        "unbalanced-close",
        "bare-array",
        "extra-statement",
    ],
)
def test_scope_default_allows_only_empty_text_constants_without_evaluating_expressions(
    tmp_path, default, allowed
):
    database = sa.create_engine(f"sqlite:///{tmp_path / 'grant-default.db'}")
    try:
        with database.begin() as connection:
            keys = TABLES["mcp_api_keys"]
            keys.create(connection)
            columns = {"mcp_api_keys": {"scopes": {"default": default}}}
            tool = schema_tool()
            queries = []

            def capture(conn, cursor, statement, parameters, context, executemany):
                queries.append(statement)

            sa.event.listen(connection, "before_cursor_execute", capture)
            try:
                if allowed:
                    tool.validate_existing_grants(connection, keys, columns)
                    assert len(queries) == 1
                else:
                    with pytest.raises(tool.SchemaUpgradeError, match="unsafe grant default"):
                        tool.validate_existing_grants(connection, keys, columns)
                    assert queries == []
            finally:
                sa.event.remove(connection, "before_cursor_execute", capture)
    finally:
        database.dispose()


@pytest.mark.parametrize("engine", ["pg"], indirect=True)
@pytest.mark.parametrize(
    "default",
    [
        "(( '[]'::jsonb || '[\"platform.write\"]'::jsonb ))::text",
        "('[]'::text || ' '::text)",
    ],
    ids=["json-concat", "text-concat"],
)
def test_postgres_compound_scope_default_fails_before_any_upgrade_or_row_change(engine, default):
    with engine.begin() as connection:
        seed_legacy(connection, ("mcp_api_keys", "scopes", sa.Text(), False, sa.text(default)))
        before = rows(connection)
        columns = column_shape(connection)
        tool = schema_tool()
        with mutations(engine) as written:
            with pytest.raises(tool.SchemaUpgradeError, match="unsafe grant default"):
                tool.upgrade_schema(connection)
        assert written == []
        assert rows(connection) == before
        assert column_shape(connection) == columns


@pytest.mark.parametrize("engine", ["pg"], indirect=True)
def test_postgres_maintenance_lock_covers_the_whole_upgrade_transaction(engine):
    tool = schema_tool()
    with engine.connect() as contender:
        query = sa.text("SELECT pg_try_advisory_xact_lock(:key)")
        with engine.begin() as connection:
            tool.upgrade_schema(connection)
            assert contender.execute(query, {"key": tool.MAINTENANCE_LOCK_ID}).scalar_one() is False
        assert contender.execute(query, {"key": tool.MAINTENANCE_LOCK_ID}).scalar_one() is True
        contender.rollback()


@pytest.mark.parametrize(
    "conflict",
    [
        ("apphub_apps", "revision", sa.Text(), False, "0"),
        ("apphub_apps", "status", sa.String(32), True, "DESIGNING"),
        ("mcp_api_keys", "scopes", sa.Integer(), False, "0"),
        ("mcp_api_keys", "scopes", sa.Text(), True, "[]"),
    ],
    ids=["revision-type", "status-nullable", "scopes-type", "scopes-nullable"],
)
def test_existing_column_conflict_fails_before_any_upgrade_or_stamp(engine, conflict):
    with engine.begin() as connection:
        seed_legacy(connection, conflict)
        before = rows(connection)
        columns = column_shape(connection)
        tool = schema_tool()
        with mutations(engine) as written:
            with pytest.raises(tool.SchemaUpgradeError, match=f"{conflict[0]}\\.{conflict[1]}"):
                tool.upgrade_schema(connection)
        assert written == []
        assert rows(connection) == before
        assert column_shape(connection) == columns


def test_connected_database_guard_refuses_the_test_database_without_mutations(engine):
    with engine.begin() as connection, mutations(engine) as written:
        tool = schema_tool()
        with pytest.raises(tool.SchemaUpgradeError, match="database"):
            tool.require_connected_target(connection)
        assert written == []
        assert sa.inspect(connection).get_table_names() == []


@pytest.mark.parametrize(
    "dsn",
    [
        "",
        "sqlite:///:memory:",
        "postgresql://unused:never-log-this@localhost:5432/metaplatform",
        "postgresql://unused:never-log-this@postgres:55497/metaplatform",
        "postgresql://unused:never-log-this@postgres:5432/other_database",
        "postgresql://unused:never-log-this@postgres/metaplatform",
        "postgresql://unused:never-log-this@postgres:5432/metaplatform?host=another_host",
        "postgresql://unused:never-log-this@postgres:5432/metaplatform?options=-csearch_path=other",
    ],
    ids=[
        "unset",
        "sqlite",
        "localhost",
        "wrong-port",
        "wrong-database",
        "missing-port",
        "query-host",
        "query-search-path",
    ],
)
def test_main_refuses_unapproved_target_before_connect_and_never_logs_the_url(
    monkeypatch, capsys, dsn
):
    tool = schema_tool()
    monkeypatch.setenv("MATE_DB_URL", dsn)

    def must_not_connect(*args, **kwargs):
        pytest.fail("unapproved main target must not open a connection")

    monkeypatch.setattr(tool.sa, "create_engine", must_not_connect)
    assert tool.main() == 1
    output = capsys.readouterr()
    assert "never-log-this" not in output.out + output.err
    assert not dsn or dsn not in output.out + output.err
