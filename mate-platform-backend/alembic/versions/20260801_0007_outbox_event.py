"""outbox_event table for transactional outbox (ADR-0013 / G3 hard rule closure)

Creates the ``outbox_event`` table backing the PLATFORM-EVENT-01
Transactional Outbox pattern. Each row represents one domain event
written in the same business transaction as the aggregate change;
a relay process polls ``status='pending'`` rows, publishes to Kafka,
and flips status to ``published`` (or ``dead`` after max retries).

The ``lineage_hints`` column (nullable JSON) aligns with the
DATA-D0-D8 D1 lineage side-car carried by ``Event.lineage_hints``
so downstream consumers can chain the event into the lineage graph.

Schema reference: ADR-0013 §2.1 (event_id / tenant_id / aggregate_id /
event_type / payload / occurred_at / published_at / attempts / trace_id)
extended with ``aggregate_type``, ``lineage_hints``, ``retry_count``,
and ``status`` for relay lifecycle management.

Revision ID: 0007_outbox_event
Revises: 0006_business_domains
Create Date: 2026-08-01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_outbox_event"
down_revision: Union[str, Sequence[str], None] = "0006_business_domains"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "outbox_event",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("aggregate_type", sa.String(128), nullable=False),
        sa.Column("aggregate_id", sa.String(128), nullable=False),
        sa.Column("event_type", sa.String(128), nullable=False),
        sa.Column("payload", sa.JSON, nullable=False),
        sa.Column("lineage_hints", sa.JSON, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("processed_at", sa.DateTime, nullable=True),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="pending",
        ),
    )

    # Single-column indexes (named per task spec for deterministic DDL)
    op.create_index(
        "ix_outbox_event_tenant_id", "outbox_event", ["tenant_id"]
    )
    op.create_index(
        "ix_outbox_event_event_type", "outbox_event", ["event_type"]
    )
    op.create_index(
        "ix_outbox_event_created_at", "outbox_event", ["created_at"]
    )
    op.create_index(
        "ix_outbox_event_status", "outbox_event", ["status"]
    )
    # Composite index: relay queries ``WHERE tenant_id=? AND status='pending'``
    op.create_index(
        "ix_outbox_event_tenant_status",
        "outbox_event",
        ["tenant_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_outbox_event_tenant_status", table_name="outbox_event")
    op.drop_index("ix_outbox_event_status", table_name="outbox_event")
    op.drop_index("ix_outbox_event_created_at", table_name="outbox_event")
    op.drop_index("ix_outbox_event_event_type", table_name="outbox_event")
    op.drop_index("ix_outbox_event_tenant_id", table_name="outbox_event")
    op.drop_table("outbox_event")
