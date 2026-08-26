"""Merge the two migration branches that existed before GA baseline cleanup.

``0011_copilot_user_isolation`` was created from the retention branch while
the platform/data migrations continued through ``0012`` → ``0013`` → ``0014``.
Both branches are valid and must be preserved; this revision only makes the
Alembic graph single-headed so ``upgrade head`` is deterministic.
"""
from __future__ import annotations

from collections.abc import Sequence

revision: str = "0015_merge_migration_heads"
down_revision: str | Sequence[str] | None = (
    "0014_apphub_runtime_shortlink",
    "0011_copilot_user_isolation",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Merge only; both parent branches have already applied their changes."""


def downgrade() -> None:
    """Merge only; downgrade is intentionally a no-op."""
