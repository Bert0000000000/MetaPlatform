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

from collections.abc import Sequence

from alembic import op

revision: str = "0013_ont_kernel_rls"
down_revision: str | Sequence[str] | None = "0012_federation_query"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


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
    #    connected), we CANNOT enable RLS on it.
    #
    #    F7 修正（2026-09-14）：**这里不能"静默跳过"**，也**不能**声称
    #    "下次 alembic upgrade head 会补上" —— Alembic 按 revision 记账，
    #    已应用的 revision **不会重跑**，所以静默跳过 = RLS 永久缺失
    #    （实测：metaplatform 库 28 张 ont_* 表 rls=false、无策略、且
    #    alembic_version 表都不存在）。
    #
    #    正确做法：本迁移跑完若仍有缺表，响亮告警并提示用幂等脚本补开：
    #        python scripts/ont/apply_rls.py
    #    （该脚本按实际存在的表逐一 ENABLE/FORCE RLS + 建策略，可反复执行）
    # ------------------------------------------------------------------
    raw = bind.exec_driver_sql(
        "SELECT tablename FROM pg_tables "
        "WHERE schemaname = current_schema() "
        f"AND tablename IN ({','.join(repr(t) for t in KERNEL01_V2_TABLES)})"
    )
    existing: set[str] = {row[0] for row in raw.fetchall()}
    missing = sorted(set(KERNEL01_V2_TABLES) - existing)
    if missing:
        import logging

        logging.getLogger(__name__).warning(
            "ont_kernel_rls: %d/%d tables not created yet (%s) — RLS NOT applied to them. "
            "Alembic will NOT retry this revision. Run `python scripts/ont/apply_rls.py` "
            "after the ontology service has created the tables.",
            len(missing),
            len(KERNEL01_V2_TABLES),
            ", ".join(missing),
        )

    # ------------------------------------------------------------------
    # 1. Backfill NULL tenant_id rows to 'system' (safety net; DDL
    #    declares tenant_id NOT NULL but guard against legacy data).
    # ------------------------------------------------------------------
    for table in existing:
        op.execute(f"UPDATE {table} SET tenant_id = 'system' WHERE tenant_id IS NULL")

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
