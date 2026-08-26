"""Prepare the dedicated non-privileged PostgreSQL database for Ontology RLS tests.

The regular local ``meta`` role is a PostgreSQL superuser, which bypasses even
``FORCE ROW LEVEL SECURITY``.  This script provisions only the dedicated test
role/database and leaves the application database untouched.

Usage (from ``mate-platform-backend`` with uv):

    uv run python ../scripts/ci/prepare_ont_rls_test_db.py

The test suite can then run with the default DSN or an explicit ``PG_DSN``.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2  # type: ignore
from psycopg2 import sql  # type: ignore


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPOSITORY_ROOT / "mate-platform-backend"
for package_src in (BACKEND_ROOT / "packages").glob("*/src"):
    sys.path.insert(0, str(package_src))


ADMIN_DSN = os.getenv(
    "ONT_RLS_ADMIN_DSN", "postgresql://meta:meta@localhost:5432/postgres"
)
TEST_ROLE = "mate_ont_test"
TEST_PASSWORD = os.getenv("ONT_RLS_TEST_PASSWORD", TEST_ROLE)
TEST_DATABASE = "metaplatform_ont_test"

KERNEL01_V2_TABLES: tuple[str, ...] = (
    "ont_individual",
    "ont_object_type",
    "ont_action_type",
    "ont_link_type",
    "ont_link_instance",
    "ont_interface",
    "ont_property",
    "ont_axiom",
    "ont_function",
)


def _execute_ident(cur: object, statement: str, *identifiers: str) -> None:
    """Execute a statement whose identifiers are all fixed/validated names."""
    assert all(value.replace("_", "").isalnum() for value in identifiers)
    cur.execute(sql.SQL(statement).format(*(sql.Identifier(value) for value in identifiers)))  # type: ignore[attr-defined]


def _ensure_role() -> None:
    with psycopg2.connect(ADMIN_DSN, connect_timeout=5) as conn:  # type: ignore
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (TEST_ROLE,))
            if cur.fetchone() is None:
                cur.execute(
                    sql.SQL(
                        "CREATE ROLE {} LOGIN PASSWORD %s NOSUPERUSER "
                        "NOBYPASSRLS"
                    ).format(sql.Identifier(TEST_ROLE)),
                    (TEST_PASSWORD,),
                )
            else:
                cur.execute(
                    sql.SQL(
                        "ALTER ROLE {} WITH LOGIN PASSWORD %s NOSUPERUSER "
                        "NOBYPASSRLS"
                    ).format(sql.Identifier(TEST_ROLE)),
                    (TEST_PASSWORD,),
                )


def _ensure_database() -> None:
    with psycopg2.connect(ADMIN_DSN, connect_timeout=5) as conn:  # type: ignore
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DATABASE,)
            )
            if cur.fetchone() is None:
                cur.execute(
                    sql.SQL("CREATE DATABASE {} OWNER {}").format(
                        sql.Identifier(TEST_DATABASE), sql.Identifier(TEST_ROLE)
                    )
                )
            else:
                cur.execute(
                    sql.SQL("ALTER DATABASE {} OWNER TO {}").format(
                        sql.Identifier(TEST_DATABASE), sql.Identifier(TEST_ROLE)
                    )
                )
            _execute_ident(
                cur, "ALTER DATABASE {} SET app.tenant_id = ''", TEST_DATABASE
            )


def _ensure_table_ownership() -> None:
    """Make pre-existing ontology test tables manageable by the test owner.

    The repository's idempotent bootstrap DDL also verifies/adds columns and
    indexes on its auxiliary ``ont_*`` tables.  This remains scoped to the
    dedicated test database; application databases are never connected here.
    """
    with psycopg2.connect(
        ADMIN_DSN, dbname=TEST_DATABASE, connect_timeout=5
    ) as conn:  # type: ignore
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT c.relname FROM pg_class c "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' AND c.relname LIKE 'ont_%' "
                "AND c.relkind = 'r' ORDER BY c.relname"
            )
            for (table,) in cur.fetchall():
                _execute_ident(cur, "ALTER TABLE {} OWNER TO {}", table, TEST_ROLE)


def _ensure_schema_and_rls() -> None:
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    repo = PgOntologyRepository(
        dsn=os.getenv(
            "PG_DSN",
            f"postgresql://{TEST_ROLE}:{TEST_PASSWORD}"
            f"@localhost:5432/{TEST_DATABASE}",
        )
    )
    repo._ensure_schema()

    with psycopg2.connect(repo._dsn, connect_timeout=5) as conn:  # type: ignore
        conn.autocommit = True
        with conn.cursor() as cur:
            for table in KERNEL01_V2_TABLES:
                _execute_ident(
                    cur, "ALTER TABLE {} ENABLE ROW LEVEL SECURITY", table
                )
                _execute_ident(
                    cur, "DROP POLICY IF EXISTS tenant_isolation ON {}", table
                )
                _execute_ident(
                    cur,
                    "CREATE POLICY tenant_isolation ON {} "
                    "USING (tenant_id = current_setting('app.tenant_id')::text) "
                    "WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)",
                    table,
                )
                _execute_ident(
                    cur, "ALTER TABLE {} FORCE ROW LEVEL SECURITY", table
                )


def main() -> None:
    _ensure_role()
    _ensure_database()
    _ensure_table_ownership()
    _ensure_schema_and_rls()

    test_dsn = os.getenv(
        "PG_DSN",
        f"postgresql://{TEST_ROLE}:{TEST_PASSWORD}"
        f"@localhost:5432/{TEST_DATABASE}",
    )
    with psycopg2.connect(test_dsn, connect_timeout=5) as conn:  # type: ignore
        with conn.cursor() as cur:
            cur.execute(
                "SELECT current_user, rolsuper, rolbypassrls "
                "FROM pg_roles WHERE rolname = current_user"
            )
            user, superuser, bypassrls = cur.fetchone()
            if user != TEST_ROLE or superuser or bypassrls:
                raise RuntimeError(
                    "RLS test connection is not the expected non-privileged role"
                )
            cur.execute("SELECT current_setting('app.tenant_id')")
            default_tenant = cur.fetchone()[0]
            if default_tenant != "":
                raise RuntimeError(
                    f"unexpected app.tenant_id database default: {default_tenant!r}"
                )
    print(
        f"Prepared {TEST_DATABASE!r} with role {TEST_ROLE!r}: "
        f"{len(KERNEL01_V2_TABLES)} forced-RLS tables"
    )


if __name__ == "__main__":
    main()
