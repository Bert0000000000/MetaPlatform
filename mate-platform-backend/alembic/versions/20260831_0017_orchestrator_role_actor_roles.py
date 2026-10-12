"""Add role-level invocation authorization to persisted orchestrator roles.

Older developer and deployed databases have ``orchestrator_roles`` without
``allowed_actor_roles``.  The application also has a narrow idempotent guard
for restart-safe local Docker upgrades; this migration remains the canonical
production schema change.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_orchestrator_role_actor_roles"
down_revision: str | Sequence[str] | None = "0016_wfe_plan_definitions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    # This historical revision has 33 characters; Alembic defaults to VARCHAR(32).
    if bind.dialect.name == "postgresql" and "alembic_version" in inspector.get_table_names():
        version = next(c for c in inspector.get_columns("alembic_version") if c["name"] == "version_num")
        if getattr(version["type"], "length", None) is not None and version["type"].length < 64:
            op.alter_column("alembic_version", "version_num", type_=sa.String(64), existing_type=version["type"])
    if "orchestrator_roles" not in inspector.get_table_names():
        # Historically created by SqlRoleStore startup, not an earlier migration.
        # Keep the schema explicit so future ORM changes cannot alter this revision.
        op.create_table(
            "orchestrator_roles",
            sa.Column("tenant_id", sa.String(64), primary_key=True),
            sa.Column("role", sa.String(64), primary_key=True),
            sa.Column("name", sa.String(256), nullable=False),
            sa.Column("capabilities", sa.Text(), nullable=False),
            sa.Column("allowed_actor_roles", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.String(64), nullable=False),
        )
    elif "allowed_actor_roles" not in {c["name"] for c in inspector.get_columns("orchestrator_roles")}:
        op.add_column(
            "orchestrator_roles",
            sa.Column("allowed_actor_roles", sa.Text(), nullable=False, server_default="[]"),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "orchestrator_roles" in inspector.get_table_names() and "allowed_actor_roles" in {
        c["name"] for c in inspector.get_columns("orchestrator_roles")
    }:
        op.drop_column("orchestrator_roles", "allowed_actor_roles")
