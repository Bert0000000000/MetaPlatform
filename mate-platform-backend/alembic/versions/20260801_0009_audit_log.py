"""Alembic 0009 — audit_log table (DATA-D5).

Persists cross-tenant data access events emitted by
``mate_platform.auth.audit.emit_cross_tenant_data_access``.

Per ADR-0016 §3.3 D5: every cross-tenant access writes a
structured audit row so the security team can review per-tenant
data exposure. The table is write-mostly; reads go through the
admin dashboard (mate-tech-iam).
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009_audit_log"
down_revision = "0008_tenant_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("actor_user_id", sa.String(128), nullable=False, index=True),
        sa.Column("actor_tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("target_tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("operation", sa.String(32), nullable=False),
        sa.Column("dataset", sa.String(256), nullable=False),
        sa.Column("trace_id", sa.String(128), nullable=False, index=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, index=True),
        # composite index for common admin query: actor → target within a window
    )
    op.create_index(
        "ix_audit_log_actor_target",
        "audit_log",
        ["actor_tenant_id", "target_tenant_id", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_log_actor_target", table_name="audit_log")
    op.drop_table("audit_log")
