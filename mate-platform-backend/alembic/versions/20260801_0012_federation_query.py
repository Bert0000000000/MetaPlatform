"""Alembic 0012 — federation_query table (DATA-D8).

Persists cross-domain federation queries for audit + lineage.
The federation engine (``mate_platform.federation``) writes one
row per query execution; the ``CrossDomainAuditSink`` in
``observability.xdomain_audit`` emits the structured event to
OBS in parallel.

Per ADR-0016 §3.3 D8.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0012_federation_query"
down_revision = "0011_pii_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "federation_query",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("actor_user_id", sa.String(128), nullable=False, index=True),
        sa.Column("actor_tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column(
            "target_tenants",
            sa.Text,
            nullable=False,
        ),  # comma-separated tenant list
        sa.Column("query", sa.Text, nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="completed"),
        # completed | failed | partial
        sa.Column("rows_returned", sa.Integer, nullable=True),
        sa.Column("domains_queried", sa.String(256), nullable=True),
        sa.Column("trace_id", sa.String(128), nullable=False, index=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )
    op.create_index(
        "ix_federation_query_actor_tenants",
        "federation_query",
        ["actor_tenant_id", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_federation_query_actor_tenants", table_name="federation_query")
    op.drop_table("federation_query")
