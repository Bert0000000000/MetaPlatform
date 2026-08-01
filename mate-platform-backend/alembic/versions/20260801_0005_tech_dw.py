"""dw domain: digital workforce SQL tables (P3-W3 TD-5)

Adds 14 tables for the mate-tech-dw domain:
  - dw_auth_logins / dw_collaborations / dw_commits / dw_documents
  - dw_employees / dw_employee_tasks / dw_evaluations / dw_extracts
  - dw_knowledge_bases / dw_learning_extracts / dw_learning_feedbacks
  - dw_models / dw_tools / dw_traces

The single tuple field (DwEmployee.kb_ids) is stored as
newline-separated TEXT and re-hydrated by sql_store.py.

Revision ID: 0005_tech_dw
Revises: 0004_app_wfe
Create Date: 2026-08-01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_tech_dw"
down_revision: Union[str, Sequence[str], None] = "0004_app_wfe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- dw_auth_logins ---
    op.create_table(
        "dw_auth_logins",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("login_at", sa.String(64), default=""),
        sa.Column("ip", sa.String(64), default=""),
        sa.Column("status", sa.String(32), default="success"),
    )
    # --- dw_collaborations ---
    op.create_table(
        "dw_collaborations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("peer_employee_id", sa.String(64), default=""),
        sa.Column("session_id", sa.String(64), default=""),
        sa.Column("started_at", sa.String(64), default=""),
        sa.Column("duration_ms", sa.Integer, default=0),
    )
    # --- dw_commits ---
    op.create_table(
        "dw_commits",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("scope", sa.String(32), default=""),
        sa.Column("target_id", sa.String(64), default=""),
        sa.Column("summary", sa.Text, default=""),
        sa.Column("committed_at", sa.String(64), default=""),
    )
    # --- dw_documents ---
    op.create_table(
        "dw_documents",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("kind", sa.String(32), default=""),
        sa.Column("size_bytes", sa.Integer, default=0),
        sa.Column("uploaded_by", sa.String(64), default=""),
        sa.Column("uploaded_at", sa.String(64), default=""),
        sa.Column("kb_id", sa.String(64), default=""),
    )
    # --- dw_employees ---
    op.create_table(
        "dw_employees",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("code", sa.String(64), default=""),
        sa.Column("role", sa.String(32), default=""),
        sa.Column("status", sa.String(32), default="active"),
        sa.Column("model_id", sa.String(64), default=""),
        sa.Column("kb_ids", sa.Text, default=""),
    )
    # --- dw_employee_tasks ---
    op.create_table(
        "dw_employee_tasks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("title", sa.String(256), default=""),
        sa.Column("status", sa.String(32), default="pending"),
        sa.Column("started_at", sa.String(64), default=""),
        sa.Column("finished_at", sa.String(64), nullable=True, default=None),
        sa.Column("duration_ms", sa.Integer, default=0),
    )
    # --- dw_evaluations ---
    op.create_table(
        "dw_evaluations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("qa_set_id", sa.String(64), default=""),
        sa.Column("score", sa.Float, default=0.0),
        sa.Column("passed", sa.Boolean, default=False),
        sa.Column("evaluated_at", sa.String(64), default=""),
    )
    # --- dw_extracts ---
    op.create_table(
        "dw_extracts",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("source", sa.String(32), default=""),
        sa.Column("source_id", sa.String(64), default=""),
        sa.Column("extracted_facts", sa.Integer, default=0),
        sa.Column("extracted_at", sa.String(64), default=""),
    )
    # --- dw_knowledge_bases ---
    op.create_table(
        "dw_knowledge_bases",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("code", sa.String(64), default=""),
        sa.Column("docs", sa.Integer, default=0),
        sa.Column("vectors", sa.Integer, default=0),
        sa.Column("owner", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    # --- dw_learning_extracts ---
    op.create_table(
        "dw_learning_extracts",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("scenario", sa.String(128), default=""),
        sa.Column("extracted_at", sa.String(64), default=""),
        sa.Column("facts", sa.Integer, default=0),
    )
    # --- dw_learning_feedbacks ---
    op.create_table(
        "dw_learning_feedbacks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("scenario", sa.String(128), default=""),
        sa.Column("rating", sa.Integer, default=0),
        sa.Column("comment", sa.Text, default=""),
        sa.Column("feedback_at", sa.String(64), default=""),
    )
    # --- dw_models ---
    op.create_table(
        "dw_models",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("provider", sa.String(64), default=""),
        sa.Column("model_id", sa.String(128), default=""),
        sa.Column("display_name", sa.String(256), default=""),
        sa.Column("modality", sa.String(32), default="text"),
        sa.Column("enabled", sa.Boolean, default=True),
    )
    # --- dw_tools ---
    op.create_table(
        "dw_tools",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("code", sa.String(64), default=""),
        sa.Column("kind", sa.String(32), default=""),
        sa.Column("enabled", sa.Boolean, default=True),
        sa.Column("invocations", sa.Integer, default=0),
    )
    # --- dw_traces ---
    op.create_table(
        "dw_traces",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("employee_id", sa.String(64), default=""),
        sa.Column("trace_id", sa.String(128), default=""),
        sa.Column("span_count", sa.Integer, default=0),
        sa.Column("status", sa.String(32), default="ok"),
        sa.Column("duration_ms", sa.Integer, default=0),
        sa.Column("started_at", sa.String(64), default=""),
    )


def downgrade() -> None:
    op.drop_table("dw_traces")
    op.drop_table("dw_tools")
    op.drop_table("dw_models")
    op.drop_table("dw_learning_feedbacks")
    op.drop_table("dw_learning_extracts")
    op.drop_table("dw_knowledge_bases")
    op.drop_table("dw_extracts")
    op.drop_table("dw_evaluations")
    op.drop_table("dw_employee_tasks")
    op.drop_table("dw_employees")
    op.drop_table("dw_documents")
    op.drop_table("dw_commits")
    op.drop_table("dw_collaborations")
    op.drop_table("dw_auth_logins")
