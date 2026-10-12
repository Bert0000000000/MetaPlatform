"""Persist verified MCP key grants; legacy keys intentionally have no grants."""
from alembic import op
import sqlalchemy as sa
revision = "0022_mcp_key_scopes"
down_revision = "0021_apphub_publication"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("mcp_api_keys", sa.Column("scopes", sa.Text(), nullable=False, server_default="[]"))

def downgrade():
    op.drop_column("mcp_api_keys", "scopes")
