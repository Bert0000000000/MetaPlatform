"""Add mcp_api_keys — long-lived API keys for external MCP clients (ADR-0062).

Stores only the sha256 of each key (hard rule 12). Deliberately NOT added to
the tenant RLS table list in ``20260801_0008_tenant_rls``: verification looks a
row up by ``key_hash`` before any tenant context exists, so an RLS policy keyed
on ``current_setting('app.tenant_id')`` would reject every lookup and make all
keys unusable. See ADR-0062 §2.1 for the security argument.

The existence guard mirrors the restart-safe pattern used elsewhere in this
chain: the MCP service also creates this single table on startup with
``checkfirst=True`` for local Docker upgrades, so the migration must tolerate
the table already being present.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0018_mcp_api_keys"
down_revision: str | Sequence[str] | None = "0017_orchestrator_role_actor_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "mcp_api_keys"


def upgrade() -> None:
    bind = op.get_bind()
    if TABLE in sa.inspect(bind).get_table_names():
        return

    op.create_table(
        TABLE,
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("key_name", sa.String(128), default=""),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("key_prefix", sa.String(16), default=""),
        sa.Column("blocked", sa.Boolean, default=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("created_by", sa.String(64), default=""),
    )


def downgrade() -> None:
    op.drop_table(TABLE)
