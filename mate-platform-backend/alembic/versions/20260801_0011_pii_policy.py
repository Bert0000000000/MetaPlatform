"""Alembic 0011 — pii_policy table (DATA-D7).

Per-tenant PII redaction policy that controls which PII kinds
are masked and whether the redaction is reversible.

The policy is read by ``mate_platform.security.pii`` at runtime
to apply consistent redaction across:
  - outbox events (Kafka) — D0/D1
  - llmgw prompts (LLM input) — llmgw/security/pii_mask.py
  - CDC consumers (Debezium) — D0

Per ADR-0016 §3.3 D7.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011_pii_policy"
down_revision = "0010_retention"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pii_policy",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, unique=True, index=True),
        # Comma-separated list of active PII kinds:
        # phone_cn, id_card_cn, email, ssn, credit_card, ip_v4
        sa.Column("enabled_kinds", sa.String(256), nullable=False, server_default="phone_cn,id_card_cn,email,credit_card"),
        sa.Column("reversible", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("mask_token", sa.String(32), nullable=False, server_default="[REDACTED]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("pii_policy")
