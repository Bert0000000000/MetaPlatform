"""data platform: data + etl + metrics + scheduler SQL tables (P3-W2 TD-5)

Adds 6 tables for the 4 data-platform domains:
  - data_cdc_tasks / data_sources (mate-tech-data)
  - etl_tasks (mate-tech-etl)
  - metrics (mate-tech-metrics)
  - scheduler_tasks (mate-tech-scheduler)

Dict fields (config / connection_config) are stored as JSON TEXT and
re-hydrated by the per-domain sql_store modules.

Revision ID: 0002_data_platform
Revises: 0001_baseline
Create Date: 2026-08-01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_data_platform"
down_revision: Union[str, Sequence[str], None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- mate-tech-data: data_cdc_tasks ---
    op.create_table(
        "data_cdc_tasks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("source_id", sa.String(64), nullable=False),
        sa.Column("target_table", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), default="running"),
        sa.Column("config", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    # --- mate-tech-data: data_sources ---
    op.create_table(
        "data_sources",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("connection_config", sa.Text, default="{}"),
        sa.Column("status", sa.String(32), default="connected"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    # --- mate-tech-etl: etl_tasks ---
    op.create_table(
        "etl_tasks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("source_table", sa.String(128), nullable=False),
        sa.Column("target_table", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), default="idle"),
        sa.Column("config", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
        sa.Column("last_run_at", sa.String(64), default=""),
    )
    # --- mate-tech-metrics: metrics ---
    op.create_table(
        "metrics",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("expression", sa.Text, nullable=False),
        sa.Column("status", sa.String(32), default="draft"),
        sa.Column("description", sa.Text, default=""),
        sa.Column("config", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
        sa.Column("last_computed_at", sa.String(64), default=""),
    )
    # --- mate-tech-scheduler: scheduler_tasks ---
    op.create_table(
        "scheduler_tasks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("cron_expression", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), default="active"),
        sa.Column("config", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
        sa.Column("last_run_at", sa.String(64), default=""),
    )


def downgrade() -> None:
    op.drop_table("scheduler_tasks")
    op.drop_table("metrics")
    op.drop_table("etl_tasks")
    op.drop_table("data_sources")
    op.drop_table("data_cdc_tasks")
