"""baseline: arch + copilot + a2a SQL tables (P3-W1 TD-5)

Initial Alembic migration capturing the 3 already-SQL-ized domains
(arch / copilot / a2a) as the baseline. Future TD-5 waves will add
migrations for data / etl / metrics / scheduler / apphub / dw / wfe.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-08-01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- arch_* tables (25 entities, key ones) ---
    op.create_table(
        "arch_applications",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("category", sa.String(64), default=""),
        sa.Column("owner", sa.String(128), default=""),
        sa.Column("status", sa.String(32), default="active"),
        sa.Column("description", sa.Text, default=""),
    )
    op.create_table(
        "arch_capabilities",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("parent_id", sa.String(64), default=""),
        sa.Column("level", sa.Integer, default=1),
        sa.Column("description", sa.Text, default=""),
    )
    op.create_table(
        "arch_data_assets",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("layer", sa.String(16), default=""),
        sa.Column("domain", sa.String(64), default=""),
        sa.Column("owner", sa.String(128), default=""),
        sa.Column("status", sa.String(32), default="accepted"),
    )
    op.create_table(
        "arch_data_entities",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("data_asset_id", sa.String(64), default=""),
        sa.Column("fields", sa.Text, default=""),
    )
    op.create_table(
        "arch_data_flows",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("source_entity_id", sa.String(64), default=""),
        sa.Column("target_entity_id", sa.String(64), default=""),
        sa.Column("flow_type", sa.String(32), default=""),
    )

    # --- copilot_* tables (11 entities) ---
    op.create_table(
        "copilot_conversations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("summary", sa.Text, default=""),
        sa.Column("message_count", sa.Integer, default=0),
        sa.Column("created_at", sa.String(64), default=""),
    )
    op.create_table(
        "copilot_queries",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("sql", sa.Text, nullable=False),
        sa.Column("datasource_id", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), default="ok"),
        sa.Column("row_count", sa.Integer, default=0),
        sa.Column("created_at", sa.String(64), default=""),
    )
    op.create_table(
        "copilot_plans",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("goal", sa.Text, nullable=False),
        sa.Column("steps", sa.Text, default=""),
        sa.Column("status", sa.String(32), default="draft"),
    )
    op.create_table(
        "copilot_datasources",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("description", sa.Text, default=""),
        sa.Column("status", sa.String(32), default="active"),
    )

    # --- a2a_* tables (5 entities, key ones) ---
    op.create_table(
        "a2a_agents",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, default=""),
        sa.Column("endpoint_url", sa.String(512), default=""),
        sa.Column("status", sa.String(32), default="active"),
    )
    op.create_table(
        "a2a_delegation_tasks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("delegator_id", sa.String(64), nullable=False),
        sa.Column("delegatee_id", sa.String(64), nullable=False),
        sa.Column("task_type", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), default="pending"),
        sa.Column("result", sa.Text, default=""),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )


def downgrade() -> None:
    op.drop_table("a2a_delegation_tasks")
    op.drop_table("a2a_agents")
    op.drop_table("copilot_datasources")
    op.drop_table("copilot_plans")
    op.drop_table("copilot_queries")
    op.drop_table("copilot_conversations")
    op.drop_table("arch_data_flows")
    op.drop_table("arch_data_entities")
    op.drop_table("arch_data_assets")
    op.drop_table("arch_capabilities")
    op.drop_table("arch_applications")
