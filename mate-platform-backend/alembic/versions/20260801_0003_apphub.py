"""apphub: app + group + module + page + template SQL tables (P3-W3 TD-5)

Adds 5 tables for the mate-app-hub domain:
  - apphub_apps      (ApphubApp, tags stored as newline-separated TEXT)
  - apphub_groups    (ApphubGroup)
  - apphub_modules   (ApphubModule)
  - apphub_pages     (ApphubPage)
  - apphub_templates (ApphubTemplate, content stored as JSON TEXT)

Tuple fields (tags) and dict fields (content) are serialised by the
sql_store module and re-hydrated on read.

Revision ID: 0003_apphub
Revises: 0002_data_platform
Create Date: 2026-08-01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_apphub"
down_revision: Union[str, Sequence[str], None] = "0002_data_platform"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- apphub_apps ---
    op.create_table(
        "apphub_apps",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("category", sa.String(64), default=""),
        sa.Column("description", sa.Text, default=""),
        sa.Column("version", sa.String(32), default="1.0.0"),
        sa.Column("owner", sa.String(128), default="platform-team"),
        sa.Column("tags", sa.Text, default=""),
    )
    # --- apphub_groups ---
    op.create_table(
        "apphub_groups",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("icon", sa.String(64), default=""),
        sa.Column("sort_order", sa.Integer, default=0),
    )
    # --- apphub_modules ---
    op.create_table(
        "apphub_modules",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("app_code", sa.String(64), default=""),
        sa.Column("description", sa.Text, default=""),
        sa.Column("entry_path", sa.String(256), default=""),
    )
    # --- apphub_pages ---
    op.create_table(
        "apphub_pages",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("module_code", sa.String(64), default=""),
        sa.Column("layout", sa.String(32), default="single"),
        sa.Column("schema_version", sa.Integer, default=1),
    )
    # --- apphub_templates ---
    op.create_table(
        "apphub_templates",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("template_type", sa.String(32), default=""),
        sa.Column("description", sa.Text, default=""),
        sa.Column("content", sa.Text, default="{}"),
    )


def downgrade() -> None:
    op.drop_table("apphub_templates")
    op.drop_table("apphub_pages")
    op.drop_table("apphub_modules")
    op.drop_table("apphub_groups")
    op.drop_table("apphub_apps")
