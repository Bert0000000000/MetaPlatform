"""install service — 幂等创建 install + 触发 orchestrator。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.install import Install


async def create_install(
    *,
    session: AsyncSession,
    kind: str,
    artifact_id: uuid.UUID,
    version: str,
    installed_by: uuid.UUID,
    tenant_id: uuid.UUID | None = None,
) -> tuple[uuid.UUID, bool]:
    """幂等创建 install。返回 (install_id, already_installed).

    命中 partial unique → 返回现有;否则新建并落 downloading 状态。
    """
    existing = await session.scalar(
        select(Install).where(
            Install.kind == kind,
            Install.artifact_id == artifact_id,
            Install.version == version,
            Install.state.in_(
                ("downloading", "verifying", "installed")
            ),
        )
    )
    if existing is not None:
        return existing.id, True

    install = Install(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        kind=kind,
        artifact_id=artifact_id,
        version=version,
        digest_sha256="0" * 64,
        state="downloading",
        installed_by=installed_by,
        retry_count=0,
        installed_at=None,
        created_at=datetime.now(timezone.utc),
    )
    session.add(install)
    await session.flush()
    return install.id, False