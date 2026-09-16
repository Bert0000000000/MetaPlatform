"""Add mcp_clients — persistent external-client registry (1.1 task 1b).

``mate_tech_mcp.clients_repo`` kept the MCP center's external-client list in a
module-level dict, so it vanished on restart and diverged across replicas.
This migration materialises the backing table and puts it under the same
tenant RLS policy as the rest of the ``mcp_*`` catalog (see
``20260801_0008_tenant_rls``).

``FORCE ROW LEVEL SECURITY`` matters here: the table owner bypasses RLS by
default, and the service role that runs ``checkfirst=True`` creation on
startup is the owner — without FORCE the isolation would silently not apply.

The existence guard mirrors the restart-safe pattern used elsewhere in this
chain: the MCP service also creates this single table on startup with
``checkfirst=True`` for local Docker upgrades, so the migration must tolerate
the table already being present.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020_mcp_clients"
down_revision: str | Sequence[str] | None = "0019_apphub_business_domains"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "mcp_clients"


def upgrade() -> None:
    bind = op.get_bind()
    if TABLE not in sa.inspect(bind).get_table_names():
        op.create_table(
            TABLE,
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
            sa.Column("name", sa.String(256), default=""),
            sa.Column("endpoint", sa.String(512), default=""),
            sa.Column("base_url", sa.String(512), default=""),
            sa.Column("client_type", sa.String(32), default="REMOTE"),
            sa.Column("transport_type", sa.String(32), default="HTTP"),
            sa.Column("auth_type", sa.String(32), default="none"),
            sa.Column("auth_token", sa.Text, default=""),
            sa.Column("timeout_ms", sa.Integer, default=30000),
            sa.Column("headers", sa.Text, default=""),
            sa.Column("server_ids", sa.Text, default=""),
            sa.Column("config", sa.Text, default=""),
            sa.Column("status", sa.String(32), default="disconnected"),
            sa.Column("discovered_tools", sa.Integer, default=0),
            sa.Column("last_connected_at", sa.String(64), default=""),
            sa.Column("last_sync_at", sa.String(64), default=""),
            sa.Column("created_at", sa.String(64), default=""),
            sa.Column("updated_at", sa.String(64), default=""),
        )

    if bind.dialect.name != "postgresql":
        # RLS is PostgreSQL-specific; SQLite / MySQL dev rely on the
        # SQLAlchemy event listener (db_filter.py) plus this module's filter.
        return

    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY tenant_isolation ON {TABLE} "
        "USING (tenant_id = current_setting('app.tenant_id')::text) "
        "WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)"
    )
    op.execute(f"ALTER TABLE {TABLE} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {TABLE}")
        op.execute(f"ALTER TABLE {TABLE} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {TABLE} DISABLE ROW LEVEL SECURITY")
    op.drop_table(TABLE)
