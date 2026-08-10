"""PostgreSQL Row-Level Security for KERNEL-01 v2 ontology tables (GOVERN-06)

Closes the gap left by Alembic 0008 ``tenant_rls`` migration: the 9
KERNEL-01 v2 tables added by GOVERN-04 (``mate_tech_ont.v2_kernel.pg_repo``
``DDL`` tuple) were NOT in the ``TENANT_TABLES`` list, so they sat
behind the SQLAlchemy event listener only — no PG-level enforcement.

This migration enables PostgreSQL RLS on the 9 tables and attaches the
``tenant_isolation`` policy (identical predicate to Alembic 0008). The
psycopg2 bridge (``PgOntologyRepository._install_rls``) issues
``SET LOCAL app.tenant_id = '<tenant>'`` per transaction; if the
bridge is ever bypassed, the policy still denies cross-tenant reads
because ``FORCE`` is in effect.

The 9 tables:
  - ont_object_type
  - ont_individual
  - ont_action_type
  - ont_link_type
  - ont_interface
  - ont_property
  - ont_link_instance
  - ont_axiom
  - ont_function

Revision ID: 0013_ont_kernel_rls
Revises: 0012_federation_query
Create Date: 2026-08-07

This migration is a **no-op on non-PostgreSQL backends** (SQLite dev /
MySQL). RLS is a PostgreSQL-specific feature; the SQLAlchemy event
listener remains the primary enforcement on those backends.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0013_ont_kernel_rls"
down_revision: Union[str, Sequence[str], None] = "0012_federation_query"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# KERNEL-01 v2 tables — created by ``mate_tech_ont.v2_kernel.pg_repo.DDL``
# at runtime via ``CREATE TABLE IF NOT EXISTS``. This migration assumes
# the tables already exist; if not, the migration is a no-op (the PG
# repo will create them on first connect with tenant_id columns).
# ---------------------------------------------------------------------------
KERNEL01_V2_TABLES: tuple[str, ...] = (
    "ont_object_type",
    "ont_individual",
    "ont_action_type",
    "ont_link_type",
    "ont_interface",
    "ont_property",
    "ont_link_instance",
    "ont_axiom",
    "ont_function",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # RLS is PostgreSQL-specific; SQLite / MySQL dev rely solely on
        # the SQLAlchemy event listener (db_filter.py).
        return

    # ------------------------------------------------------------------
    # 0. Verify each table exists; if it doesn't yet (pg_repo hasn't
    #    connected), skip silently — pg_repo.DDL will create them with
    #    a tenant_id column and the next ``alembic upgrade head`` after
    #    the service has started will pick them up.
    # ------------------------------------------------------------------
    raw = bind.exec_driver_sql(
        "SELECT tablename FROM pg_tables "
        "WHERE schemaname = current_schema() "
        f"AND tablename IN ({','.join(repr(t) for t in KERNEL01_V2_TABLES)})"
    )
    existing: set[str] = {row[0] for row in raw.fetchall()}

    # ------------------------------------------------------------------
    # 1. Backfill NULL tenant_id rows to 'system' (safety net; DDL
    #    declares tenant_id NOT NULL but guard against legacy data).
    # ------------------------------------------------------------------
    for table in existing:
        op.execute(
            f"UPDATE {table} SET tenant_id = 'system' "
            "WHERE tenant_id IS NULL"
        )

    # ------------------------------------------------------------------
    # 2. Enable RLS + create policy + force RLS on every table.
    # ------------------------------------------------------------------
    for table in existing:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} "
            "USING (tenant_id = current_setting('app.tenant_id')::text) "
            "WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)"
        )
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in KERNEL01_V2_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")