"""marketplace init — 4 张表(SPEC §3.3)

Revision ID: 2026_08_05_marketplace_init
Revises:
Create Date: 2026-08-05
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "2026_08_05_marketplace_init"
down_revision = None
branch_labels = ("marketplace",)
depends_on = None


def upgrade() -> None:
    # marketplace_subscription
    op.create_table(
        "marketplace_subscription",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("sku", sa.String(128), nullable=False),
        sa.Column("license_key", sa.String(512), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("license_payload", JSONB, nullable=False),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_marketplace_subscription_tenant",
        "marketplace_subscription",
        ["tenant_id"],
    )

    # marketplace_install — 用 PG partial unique 索引
    # alembic 的 postgresql_where 必须拆到 op.create_index,而非嵌在 create_table
    op.create_table(
        "marketplace_install",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True)),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("artifact_id", UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("digest_sha256", sa.String(64), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("installed_by", UUID(as_uuid=True), nullable=False),
        sa.Column("installed_at", sa.DateTime(timezone=True)),
        sa.Column("install_path", sa.String(512)),
        sa.Column("failure_reason", sa.Text),
        sa.Column(
            "retry_count",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_marketplace_install_kind_artifact",
        "marketplace_install",
        ["kind", "artifact_id"],
    )
    # PG partial unique — same kind+artifact+version only one active
    op.create_index(
        "uq_marketplace_install_active",
        "marketplace_install",
        ["kind", "artifact_id", "version"],
        unique=True,
        postgresql_where=sa.text(
            "state IN ('downloading','verifying','installed')"
        ),
    )

    # marketplace_instance
    op.create_table(
        "marketplace_instance",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "install_id",
            UUID(as_uuid=True),
            sa.ForeignKey("marketplace_install.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("instance_uid", sa.String(256), nullable=False),
        sa.Column("registered_digest", sa.String(64), nullable=False),
        sa.Column(
            "registered_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_marketplace_instance_install",
        "marketplace_instance",
        ["install_id"],
    )


def downgrade() -> None:
    op.drop_table("marketplace_instance")
    op.drop_index(
        "uq_marketplace_install_active", table_name="marketplace_install"
    )
    op.drop_index(
        "ix_marketplace_install_kind_artifact", table_name="marketplace_install"
    )
    op.drop_table("marketplace_install")
    op.drop_index(
        "ix_marketplace_subscription_tenant",
        table_name="marketplace_subscription",
    )
    op.drop_table("marketplace_subscription")