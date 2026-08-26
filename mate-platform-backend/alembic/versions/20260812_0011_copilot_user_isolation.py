"""Alembic 0011 — copilot conversation/message user isolation.

SuperAI chat records are scoped per user within a tenant so that
multiple users in the same tenant never see each other's conversations
or messages. Adds ``user_id`` (JWT ``sub``) to ``copilot_conversations``
and ``copilot_messages`` with backfill to the empty string (existing
dev rows are empty "新对话" shells and are intentionally not attached
to any user).

Per SuperAI multi-user isolation requirement (same tenant, per-user
session separation).
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0011_copilot_user_isolation"
down_revision = "0010_retention"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # The original 0001 baseline captured conversations but not the message
    # table, even though the ORM and this migration already depended on it.
    # Create the missing table on fresh databases; existing installations use
    # the additive column path below.
    messages_created = False
    if not inspector.has_table("copilot_messages"):
        op.create_table(
            "copilot_messages",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("conversation_id", sa.String(64), nullable=False, index=True),
            sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
            sa.Column("user_id", sa.String(64), nullable=False, server_default=""),
            sa.Column("role", sa.String(16), nullable=False),
            sa.Column("content", sa.Text, nullable=False),
            sa.Column("created_at", sa.String(64), server_default=""),
            sa.Column("metadata_json", sa.Text, server_default="{}"),
        )
        messages_created = True

    op.add_column(
        "copilot_conversations",
        sa.Column("user_id", sa.String(64), nullable=False, server_default=""),
    )
    if not messages_created:
        op.add_column(
            "copilot_messages",
            sa.Column("user_id", sa.String(64), nullable=False, server_default=""),
        )
    op.create_index("ix_copilot_conversations_user_id", "copilot_conversations", ["user_id"])
    op.create_index("ix_copilot_messages_user_id", "copilot_messages", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_copilot_messages_user_id", table_name="copilot_messages")
    op.drop_index("ix_copilot_conversations_user_id", table_name="copilot_conversations")
    op.drop_column("copilot_messages", "user_id")
    op.drop_column("copilot_conversations", "user_id")
