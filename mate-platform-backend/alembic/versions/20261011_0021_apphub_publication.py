"""Persist AppHub definitions, lifecycle and immutable publication snapshots."""
from alembic import op
import sqlalchemy as sa

revision = "0021_apphub_publication"
down_revision = "0020_mcp_clients"
branch_labels = None
depends_on = None


def upgrade():
    columns = {
        "apphub_apps": [
            sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("status", sa.String(32), nullable=False, server_default="DESIGNING"),
            sa.Column("created_at", sa.String(64), nullable=True),
            sa.Column("updated_at", sa.String(64), nullable=True),
            sa.Column("published_version_id", sa.String(64), nullable=True),
            sa.Column("versions", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("releases", sa.Text(), nullable=False, server_default="[]"),
        ],
        "apphub_pages": [sa.Column("definition", sa.Text(), nullable=False, server_default="{}")],
    }
    for table, additions in columns.items():
        existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}
        for column in additions:
            if column.name not in existing:
                op.add_column(table, column)


def downgrade():
    op.drop_column("apphub_pages", "definition")
    for column in ("revision", "releases", "versions", "published_version_id", "updated_at", "created_at", "status"):
        op.drop_column("apphub_apps", column)
