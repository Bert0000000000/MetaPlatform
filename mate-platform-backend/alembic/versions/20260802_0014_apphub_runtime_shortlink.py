"""Alembic 0014 — apphub runtime + shortlink schema (APPHUB-RUNTIME-01 Phase A).

Adds the ``apphub_shortlinks`` table and extends ``apphub_apps`` /
``apphub_modules`` with columns required by the runtime + shortlink
feature (阶段 B/C will populate them).

Tables / columns:
  - apphub_shortlinks (new): id / tenant_id / app_id / code / role /
    expires_at / created_at
  - apphub_apps +3 cols: shortlink_code / current_version_id /
    runtime_status (default 'DRAFT')
  - apphub_modules +1 col: type (default 'PAGE')

Revision ID: 0014_apphub_runtime_shortlink  (bumped from 0013 in GOVERN-06 to make
room for the ont_kernel_rls migration that runs ahead of this one).
Revises: 0013_ont_kernel_rls
Create Date: 2026-08-02
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014_apphub_runtime_shortlink"
down_revision: Union[str, Sequence[str], None] = "0013_ont_kernel_rls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- apphub_shortlinks ---
    op.create_table(
        "apphub_shortlinks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("app_id", sa.String(64), nullable=False, index=True),
        sa.Column("code", sa.String(8), nullable=False),
        sa.Column("role", sa.String(32), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # code must be unique within a tenant
    op.create_index(
        "ix_apphub_shortlinks_tenant_code",
        "apphub_shortlinks",
        ["tenant_id", "code"],
        unique=True,
    )

    # --- apphub_apps +3 cols ---
    op.add_column(
        "apphub_apps",
        sa.Column("shortlink_code", sa.String(8), nullable=True),
    )
    op.add_column(
        "apphub_apps",
        sa.Column("current_version_id", sa.String(64), nullable=True),
    )
    op.add_column(
        "apphub_apps",
        sa.Column("runtime_status", sa.String(32), nullable=True, server_default="DRAFT"),
    )

    # --- apphub_modules +1 col ---
    op.add_column(
        "apphub_modules",
        sa.Column("type", sa.String(32), nullable=True, server_default="PAGE"),
    )


def downgrade() -> None:
    # --- apphub_modules ---
    op.drop_column("apphub_modules", "type")

    # --- apphub_apps ---
    op.drop_column("apphub_apps", "runtime_status")
    op.drop_column("apphub_apps", "current_version_id")
    op.drop_column("apphub_apps", "shortlink_code")

    # --- apphub_shortlinks ---
    op.drop_index("ix_apphub_shortlinks_tenant_code", table_name="apphub_shortlinks")
    op.drop_table("apphub_shortlinks")
