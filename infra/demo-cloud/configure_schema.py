"""Apply the two additive MP11 upgrades without changing existing rows or grants."""

from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MAINTENANCE_LOCK_ID = 0x4D5031315343484D
MIGRATIONS = (
    "20261011_0021_apphub_publication.py",
    "20261012_0022_mcp_key_scopes.py",
)
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


class SchemaUpgradeError(RuntimeError):
    """An approved target or an existing column contract could not be confirmed."""


def target_tables():
    from mate_app_hub.repositories.sql_models import ApphubAppORM, ApphubPageORM

    from mate_tech_mcp.repositories.sql_models import McpApiKeyORM

    return {
        table.name: table
        for table in (ApphubAppORM.__table__, ApphubPageORM.__table__, McpApiKeyORM.__table__)
    }


def migration_module(filename):
    location = Path(__file__).resolve().parent / "migrations" / filename
    if not location.is_file():
        location = (
            Path(__file__).resolve().parents[2]
            / "mate-platform-backend/alembic/versions"
            / filename
        )
    if not location.is_file():
        raise SchemaUpgradeError(f"Required migration unavailable: {filename}")
    spec = importlib.util.spec_from_file_location(f"demo_{location.stem}", location)
    if spec is None or spec.loader is None:
        raise SchemaUpgradeError(f"Required migration unavailable: {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def matching_type(actual, expected, dialect):
    actual, expected = actual.as_generic(), expected.as_generic()
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, sa.String) and actual.length != expected.length:
        return False
    if isinstance(expected, sa.DateTime) and dialect == "postgresql":
        return actual.timezone == expected.timezone
    return True


def inspect_contract(connection, tables, allow_missing_additions):
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())
    columns = {}
    for name, table in tables.items():
        if name not in existing_tables:
            continue
        columns[name] = {column["name"]: column for column in inspector.get_columns(name)}
        for expected in table.columns:
            actual = columns[name].get(expected.name)
            if actual is None:
                if allow_missing_additions and expected.name in ADDITIONS[name]:
                    continue
                raise SchemaUpgradeError(f"Schema conflict {name}.{expected.name}: missing column")
            if not matching_type(actual["type"], expected.type, connection.dialect.name):
                raise SchemaUpgradeError(f"Schema conflict {name}.{expected.name}: type")
            if bool(actual["nullable"]) != expected.nullable:
                raise SchemaUpgradeError(f"Schema conflict {name}.{expected.name}: nullable")
    return columns


def is_empty_text_default(value):
    """Recognize the literal and optional TEXT cast without executing catalog SQL."""
    expression = str(value).strip()
    return bool(
        re.fullmatch(
            r"(?:\(\s*)*'\[\]'\s*(?:\)\s*)*(?:::\s*text\s*(?:\)\s*)*)?",
            expression,
            re.IGNORECASE,
        )
        and expression.count("(") == expression.count(")")
    )


def validate_existing_grants(connection, table, columns):
    scopes = columns.get("mcp_api_keys", {}).get("scopes")
    if scopes is None:
        return
    default = scopes["default"]
    if default is not None and not is_empty_text_default(default):
        raise SchemaUpgradeError("Schema conflict mcp_api_keys.scopes: unsafe grant default")
    for value in connection.execute(sa.select(table.c.scopes)).scalars():
        try:
            grants = json.loads(value) if isinstance(value, str) else None
        except json.JSONDecodeError:
            grants = None
        if not isinstance(grants, list) or any(not isinstance(scope, str) for scope in grants):
            raise SchemaUpgradeError("Schema conflict mcp_api_keys.scopes: invalid stored grants")
        # A manually present legacy column without the official empty default
        # must already have empty grants; never manufacture or revoke grants.
        if default is None and grants:
            raise SchemaUpgradeError(
                "Schema conflict mcp_api_keys.scopes: legacy grants are not empty"
            )


def _upgrade_in_transaction(connection):
    if connection.dialect.name == "postgresql":
        connection.execute(
            sa.text("SELECT pg_advisory_xact_lock(:key)"), {"key": MAINTENANCE_LOCK_ID}
        )
    tables = target_tables()
    before = inspect_contract(connection, tables, allow_missing_additions=True)
    validate_existing_grants(connection, tables["mcp_api_keys"], before)
    apphub, mcp = (migration_module(filename) for filename in MIGRATIONS)
    created = []
    for name, table in tables.items():
        if name not in before:
            table.create(connection, checkfirst=True)
            created.append(name)
    context = MigrationContext.configure(connection)
    with Operations.context(context):
        apphub.upgrade()
        keys = {column["name"] for column in sa.inspect(connection).get_columns("mcp_api_keys")}
        if "scopes" not in keys:
            mcp.upgrade()
    after = inspect_contract(connection, tables, allow_missing_additions=False)
    validate_existing_grants(connection, tables["mcp_api_keys"], after)
    return {
        "created_tables": sorted(created),
        "added_columns": {
            name: sorted(set(after[name]) - set(columns))
            for name, columns in before.items()
            if set(after[name]) != set(columns)
        },
    }


def upgrade_schema(connection):
    """Upgrade only the three target tables in the caller's transaction/schema."""
    if connection.in_transaction():
        return _upgrade_in_transaction(connection)
    with connection.begin():
        return _upgrade_in_transaction(connection)


def approved_url(value):
    try:
        url = sa.make_url(value)
        approved = (
            url.get_backend_name() == "postgresql"
            and url.host == "postgres"
            and url.port == 5432
            and url.database == "metaplatform"
            and not url.query
        )
    except (sa.exc.ArgumentError, ValueError):
        approved = False
    if not approved:
        raise SchemaUpgradeError("MATE_DB_URL does not identify the approved demo database")
    return url


def require_connected_target(connection):
    if connection.dialect.name != "postgresql":
        raise SchemaUpgradeError("Connected database is not PostgreSQL")
    if connection.execute(sa.text("SELECT current_database()")).scalar_one() != "metaplatform":
        raise SchemaUpgradeError("Connected database is not the approved demo database")


def main():
    engine = None
    try:
        url = approved_url(os.environ.get("MATE_DB_URL", ""))
        engine = sa.create_engine(url, echo=False)
        with engine.begin() as connection:
            require_connected_target(connection)
            changes = upgrade_schema(connection)
        print(json.dumps(changes, sort_keys=True))
        return 0
    except SchemaUpgradeError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except Exception:
        # DB driver errors may contain addresses, credentials or row values.
        print("Demo schema configuration failed; no completion recorded", file=sys.stderr)
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
