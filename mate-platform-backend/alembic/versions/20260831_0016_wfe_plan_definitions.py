"""Add persistent, versioned Action Orchestration Plan definitions.

The legacy ``wfe_flow_definitions`` BPMN records remain untouched.  These
tables own only server-validated Plan JSON and its immutable published
revisions, which the new workflow-run API resolves before starting Temporal.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016_wfe_plan_definitions"
down_revision: str | Sequence[str] | None = "0015_merge_migration_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "wfe_workflow_definitions",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("draft_plan", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("published_version", sa.Integer(), nullable=True),
        sa.Column("published_at", sa.String(64), nullable=False, server_default=""),
        sa.Column("published_by", sa.String(128), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("id", "tenant_id"),
    )
    op.create_index(
        "ix_wfe_workflow_definitions_tenant_id",
        "wfe_workflow_definitions",
        ["tenant_id"],
    )
    op.create_table(
        "wfe_workflow_definition_revisions",
        sa.Column("definition_id", sa.String(64), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("plan", sa.JSON(), nullable=False),
        sa.Column("published_at", sa.String(64), nullable=False),
        sa.Column("published_by", sa.String(128), nullable=False),
        sa.PrimaryKeyConstraint("definition_id", "tenant_id", "version"),
    )
    op.create_index(
        "ix_wfe_workflow_definition_revisions_tenant_id",
        "wfe_workflow_definition_revisions",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_wfe_workflow_definition_revisions_tenant_id",
        table_name="wfe_workflow_definition_revisions",
    )
    op.drop_table("wfe_workflow_definition_revisions")
    op.drop_index(
        "ix_wfe_workflow_definitions_tenant_id",
        table_name="wfe_workflow_definitions",
    )
    op.drop_table("wfe_workflow_definitions")
