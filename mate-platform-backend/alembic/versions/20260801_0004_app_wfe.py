"""wfe domain: flow definition / validation / test run SQL tables (P3-W3 TD-5)

Adds 3 tables for the mate-app-wfe domain:
  - wfe_flow_definitions
  - wfe_flow_validations
  - wfe_flow_test_runs

Tuple fields (FlowValidation.issues) are stored as newline-separated
TEXT; dict fields (FlowTestRun.output) are stored as JSON TEXT. Both
are re-hydrated by the sql_store module.

Revision ID: 0004_app_wfe
Revises: 0003_apphub
Create Date: 2026-08-01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_app_wfe"
down_revision: Union[str, Sequence[str], None] = "0003_apphub"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- mate-app-wfe: wfe_flow_definitions ---
    op.create_table(
        "wfe_flow_definitions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("bpmn_xml", sa.Text, default=""),
        sa.Column("version", sa.String(32), default="1.0"),
        sa.Column("status", sa.String(32), default="draft"),
    )
    # --- mate-app-wfe: wfe_flow_validations ---
    op.create_table(
        "wfe_flow_validations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("flow_id", sa.String(64), default=""),
        sa.Column("valid", sa.Boolean, default=False),
        sa.Column("issues", sa.Text, default=""),
        sa.Column("validated_at", sa.String(64), default=""),
    )
    # --- mate-app-wfe: wfe_flow_test_runs ---
    op.create_table(
        "wfe_flow_test_runs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("flow_id", sa.String(64), default=""),
        sa.Column("status", sa.String(32), default="success"),
        sa.Column("started_at", sa.String(64), default=""),
        sa.Column("finished_at", sa.String(64), default=""),
        sa.Column("duration_ms", sa.Integer, default=0),
        sa.Column("output", sa.Text, default="{}"),
    )


def downgrade() -> None:
    op.drop_table("wfe_flow_test_runs")
    op.drop_table("wfe_flow_validations")
    op.drop_table("wfe_flow_definitions")
