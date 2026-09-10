"""install service — 幂等创建 install + 触发 orchestrator。"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..domain.install import Install, InstallAudit


def create_install(
    *,
    session: Session,
    kind: str,
    artifact_id: uuid.UUID,
    version: str,
    installed_by: uuid.UUID,
    tenant_id: uuid.UUID | None = None,
) -> tuple[uuid.UUID, bool]:
    """幂等创建 install。返回 (install_id, already_installed).

    命中 partial unique → 返回现有;否则新建并落 downloading 状态。
    """
    existing = session.scalar(
        select(Install).where(
            Install.kind == kind,
            Install.artifact_id == artifact_id,
            Install.version == version,
            Install.state.in_(("downloading", "verifying", "installed")),
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
        created_at=datetime.now(UTC),
    )
    session.add(install)
    session.flush()
    return install.id, False


_TRANSITIONS: dict[str, tuple[tuple[str, ...], str]] = {
    # action → (允许的起始状态, 目标状态)
    "uninstall": (("installed", "failed", "verifying"), "uninstalling"),
    "retry": (("failed", "uninstalled"), "downloading"),
}


class InstallNotFound(LookupError):
    pass


class InvalidTransition(ValueError):
    pass


def transition_install(
    *,
    session: Session,
    install_id: uuid.UUID,
    action: str,
    actor: uuid.UUID | None = None,
) -> Install:
    """事务化状态转移（uninstall / retry）+ 审计记录（MP-MKT-INSTALL-01）。

    合法性由 _TRANSITIONS 约束；越界转移抛 InvalidTransition（API 层译 409）。
    审计写入 install_audit 表（actor/action/from/to/at）——审计与状态变更
    同一事务，保证「无审计的转移不存在」。
    """
    allowed, target = _TRANSITIONS[action]
    install = session.scalar(select(Install).where(Install.id == install_id))
    if install is None:
        raise InstallNotFound(str(install_id))
    if install.state not in allowed:
        raise InvalidTransition(
            f"install {install_id} is '{install.state}'; {action} requires one of {sorted(allowed)}"
        )
    from_status = install.state
    install.state = target
    if action == "retry":
        install.retry_count = (install.retry_count or 0) + 1
    session.add(
        InstallAudit(
            install_id=install.id,
            action=action,
            from_state=from_status,
            to_state=target,
            actor=str(actor) if actor else "",
            created_at=datetime.now(UTC),
        )
    )
    session.flush()
    return install
