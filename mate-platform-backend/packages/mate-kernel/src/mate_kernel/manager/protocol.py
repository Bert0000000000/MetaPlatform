"""MANAGER-05: Manager 协议 —— 用户级会话与 Ontology 变更管理。

Manager = 用户 / 数字员工 / SuperAI 与 Ontology 之间的"事务边界 + 权限 + 审计"中间件。
- 缓存：本会话内已经 resolve 的 ClassRef / Version（避免每次重复）
- 变更追踪：本会话产生的（ClassRef, Version, ActionType.apply）— 出 session 时 flush
- 权限：每个操作挂 TenantContext；不在 ctx 中 → 拒绝（13 硬规则 #3）

M2 范围：in-memory 实现，不接 PG。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Protocol, runtime_checkable

from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.identity.version import Version


class ManagerError(RuntimeError):
    pass


class TenantMismatchError(ManagerError):
    pass


class ChangeKind(str, Enum):
    SNAPSHOT_VERSION = "snapshot_version"
    REGISTER_CLASS = "register_class"
    APPLY_ACTION = "apply_action"


@dataclass(frozen=True, slots=True)
class TrackedChange:
    kind: ChangeKind
    target_rid: str
    payload_hash: str  # 简化：取 rid 后 8 位
    occurred_at: datetime
    actor: str


@dataclass(frozen=True, slots=True)
class ManagerLimits:
    max_cached_versions: int = 1024
    max_tracked_changes: int = 10000


@dataclass(frozen=True, slots=True)
class ManagerContext:
    """Manager 会话绑定信息 —— 等价于 TenantContext + session_id。"""
    user_id: str
    tenant_id: str
    session_id: str
    scopes: tuple[str, ...] = ()
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@runtime_checkable
class ChangeSink(Protocol):
    """变更出口 —— runtime 实现可能写 PG / Kafka / OTel。"""

    def emit(self, change: TrackedChange) -> None: ...


class NullChangeSink:
    def emit(self, change: TrackedChange) -> None:
        pass


class Manager:
    """用户级 Manager —— 缓存 + 变更追踪 + 租户一致性。"""

    def __init__(
        self,
        ctx: ManagerContext,
        sink: ChangeSink | None = None,
        limits: ManagerLimits | None = None,
    ) -> None:
        if not ctx.user_id or not ctx.tenant_id or not ctx.session_id:
            raise ManagerError("ManagerContext.user_id/tenant_id/session_id required")
        self.ctx = ctx
        self.sink = sink or NullChangeSink()
        self.limits = limits or ManagerLimits()
        self._class_cache: dict[str, ClassRef] = {}
        self._version_cache: dict[str, Version] = {}
        self._changes: list[TrackedChange] = []

    # ───── 缓存 ─────

    def cache_class(self, ref: ClassRef) -> None:
        if ref.rid in self._class_cache:
            return
        if len(self._class_cache) >= self.limits.max_cached_versions:
            return  # 满则不再写入（命中仍在）
        self._class_cache[ref.rid] = ref

    def cache_version(self, ver: Version) -> None:
        if ver.rid in self._version_cache:
            return
        if len(self._version_cache) >= self.limits.max_cached_versions:
            return
        self._version_cache[ver.rid] = ver

    def resolve_cached_class(self, rid: str) -> ClassRef | None:
        return self._class_cache.get(rid)

    def resolve_cached_version(self, rid: str) -> Version | None:
        return self._version_cache.get(rid)

    # ───── 变更追踪 ─────

    def track(
        self,
        kind: ChangeKind,
        target_rid: str,
        payload: Any = None,
        actor: str | None = None,
    ) -> TrackedChange:
        if len(self._changes) >= self.limits.max_tracked_changes:
            raise ManagerError(
                f"tracked changes exceeded limit {self.limits.max_tracked_changes}"
            )
        change = TrackedChange(
            kind=kind,
            target_rid=target_rid,
            payload_hash=self._hash(payload),
            occurred_at=datetime.now(timezone.utc),
            actor=actor or self.ctx.user_id,
        )
        self._changes.append(change)
        self.sink.emit(change)
        return change

    def drain_changes(self) -> tuple[TrackedChange, ...]:
        out = tuple(self._changes)
        self._changes = []
        return out

    def pending_changes_count(self) -> int:
        return len(self._changes)

    # ───── 租户断言 ─────

    def assert_same_tenant(self, resource_tenant: str) -> None:
        if resource_tenant != self.ctx.tenant_id:
            raise TenantMismatchError(
                f"resource tenant={resource_tenant!r} != manager tenant={self.ctx.tenant_id!r}"
            )

    # ───── helpers ─────

    @staticmethod
    def _hash(payload: Any) -> str:
        if payload is None:
            return "-" * 8
        s = repr(payload)
        return hex(abs(hash(s)))[-8:]


__all__ = [
    "ChangeKind",
    "ChangeSink",
    "Manager",
    "ManagerContext",
    "ManagerError",
    "ManagerLimits",
    "NullChangeSink",
    "TenantMismatchError",
    "TrackedChange",
]
