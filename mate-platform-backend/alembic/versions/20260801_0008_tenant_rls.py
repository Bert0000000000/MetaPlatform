"""PostgreSQL Row-Level Security (RLS) for all tenant-scoped tables (G6)

Enables PostgreSQL RLS on every table that declares a ``tenant_id``
column, providing a database-engine-level *second line of defence*
behind the SQLAlchemy event listener (``tenancy/db_filter.py``).

Per-table DDL (PostgreSQL only):

  ALTER TABLE <t> ENABLE ROW LEVEL SECURITY
  CREATE POLICY tenant_isolation ON <t>
      USING (tenant_id = current_setting('app.tenant_id')::text)
      WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)
  ALTER TABLE <t> FORCE ROW LEVEL SECURITY

``FORCE`` ensures the table owner (the migration role) is also subject
to RLS — required for production so that a compromised app role cannot
bypass the policy.

A database-level default ``app.tenant_id = ''`` is set so that
``current_setting('app.tenant_id')`` never raises; an empty value makes
the ``tenant_id = ''`` predicate match nothing (deny-by-default).

Existing rows with NULL ``tenant_id`` are back-filled to ``'system'``
before RLS is activated.

This migration is a **no-op on non-PostgreSQL backends** (SQLite dev /
MySQL). RLS is a PostgreSQL-specific feature; the SQLAlchemy event
listener remains the primary enforcement on those backends.

Revision ID: 0008_tenant_rls
Revises: 0007_outbox_event
Create Date: 2026-08-01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0008_tenant_rls"
down_revision: Union[str, Sequence[str], None] = "0007_outbox_event"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# All tables that carry a ``tenant_id`` column (0001 → 0007).
# ---------------------------------------------------------------------------
TENANT_TABLES: list[str] = [
    # 0001 baseline — arch / copilot / a2a (11)
    "arch_applications",
    "arch_capabilities",
    "arch_data_assets",
    "arch_data_entities",
    "arch_data_flows",
    "copilot_conversations",
    "copilot_queries",
    "copilot_plans",
    "copilot_datasources",
    "a2a_agents",
    "a2a_delegation_tasks",
    # 0002 data platform (5)
    "data_cdc_tasks",
    "data_sources",
    "etl_tasks",
    "metrics",
    "scheduler_tasks",
    # 0003 apphub (5)
    "apphub_apps",
    "apphub_groups",
    "apphub_modules",
    "apphub_pages",
    "apphub_templates",
    # 0004 wfe (3)
    "wfe_flow_definitions",
    "wfe_flow_validations",
    "wfe_flow_test_runs",
    # 0005 dw (14)
    "dw_auth_logins",
    "dw_collaborations",
    "dw_commits",
    "dw_documents",
    "dw_employees",
    "dw_employee_tasks",
    "dw_evaluations",
    "dw_extracts",
    "dw_knowledge_bases",
    "dw_learning_extracts",
    "dw_learning_feedbacks",
    "dw_models",
    "dw_tools",
    "dw_traces",
    # 0006 business domains — rag/ont/agent/mcp/kb/llmgw (19)
    "rag_documents",
    "rag_indexes",
    "ont_ontologies",
    "ont_classes",
    "ont_instances",
    "ont_relations",
    "ont_versions",
    "agent_agents",
    "agent_sessions",
    "agent_messages",
    "mcp_tools",
    "mcp_resources",
    "mcp_prompts",
    "kb_collections",
    "kb_documents",
    "kb_search_logs",
    "llmgw_providers",
    "llmgw_models",
    "llmgw_route_rules",
    # 0007 outbox (1)
    "outbox_event",
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # RLS is PostgreSQL-specific; SQLite / MySQL dev rely solely on
        # the SQLAlchemy event listener (db_filter.py).
        return

    # ------------------------------------------------------------------
    # 1. Backfill NULL tenant_id rows to 'system' (safety net).
    #    All columns are NOT NULL, but guard against pre-constraint data.
    # ------------------------------------------------------------------
    for table in TENANT_TABLES:
        op.execute(
            f"UPDATE {table} SET tenant_id = 'system' "
            "WHERE tenant_id IS NULL"
        )

    # ------------------------------------------------------------------
    # 2. Enable RLS + create policy + force RLS on every table.
    # ------------------------------------------------------------------
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} "
            "USING (tenant_id = current_setting('app.tenant_id')::text) "
            "WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)"
        )
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    # ------------------------------------------------------------------
    # 3. Database-level default so current_setting never raises.
    #    Empty string → predicate matches nothing → deny-by-default.
    # ------------------------------------------------------------------
    db_name = bind.engine.url.database
    op.execute(f'ALTER DATABASE "{db_name}" SET app.tenant_id = \'\'')


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
