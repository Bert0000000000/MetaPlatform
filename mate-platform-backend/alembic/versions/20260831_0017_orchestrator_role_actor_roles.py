"""Add role-level invocation authorization to persisted orchestrator roles.

Older developer and deployed databases have ``orchestrator_roles`` without
``allowed_actor_roles``.  The application also has a narrow idempotent guard
for restart-safe local Docker upgrades; this migration remains the canonical
production schema change.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_orchestrator_role_actor_roles"
down_revision: str | Sequence[str] | None = "0016_wfe_plan_definitions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orchestrator_roles",
        sa.Column(
            "allowed_actor_roles",
            sa.Text(),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("orchestrator_roles", "allowed_actor_roles")
