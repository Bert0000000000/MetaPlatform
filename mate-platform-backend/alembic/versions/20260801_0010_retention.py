"""Alembic 0010 — retention tables (DATA-D6).

Persists per-tenant retention policies + GDPR soft-delete records.
The periodic cleanup job reads these tables to enforce retention
and perform hard-deletes after the GDPR window expires.

Per ADR-0016 §3.3 D6.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010_retention"
down_revision = "0009_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- retention_policy: one row per tenant ---
    op.create_table(
        "retention_policy",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("retention_days", sa.Integer, nullable=False, server_default="0"),
        sa.Column("hard_delete_after_days", sa.Integer, nullable=False, server_default="30"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # --- gdpr_soft_delete: tracks GDPR right-to-be-forgotten workflow ---
    op.create_table(
        "gdpr_soft_delete",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("requested_by", sa.String(128), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hard_delete_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="pending",
            index=True,
        ),  # pending | executed | cancelled
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tables_deleted", sa.Integer, nullable=True),
        sa.Column("rows_deleted", sa.Integer, nullable=True),
        sa.Column("trace_id", sa.String(128), nullable=True),
    )
    # Index for the cleanup job: find all pending hard-deletes past their window.
    op.create_index(
        "ix_gdpr_soft_delete_ready",
        "gdpr_soft_delete",
        ["status", "hard_delete_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_gdpr_soft_delete_ready", table_name="gdpr_soft_delete")
    op.drop_table("gdpr_soft_delete")
    op.drop_table("retention_policy")
