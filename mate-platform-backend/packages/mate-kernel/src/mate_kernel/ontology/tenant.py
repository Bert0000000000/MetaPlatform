"""KERNEL-01 双租户上下文（ADR-0021 §4 · 替代 mate-tech-ont/security/tenant.py）。

设计：
- `TenantContext`：frozen dataclass，runtime 通过 `current_tenant()` 取得
- `set_tenant()` / `clear_tenant()`：dev/test 用 contextvars
- `require_tenant()`：HTTP / SDK 入口守护，缺 ctx 抛 `MissingTenantContextError`
- 多租户硬规则（13 硬规则 #3）：Repository 必须拿到 TenantContext 才能读写

为防回归，禁止再 import `mate_tech_ont.security.tenant`（`scripts/ci/forbid_legacy_tenant_ctx.py`）。
"""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Optional


class MissingTenantContextError(RuntimeError):
    """访问 ontology repository 前必须先设置 tenant ctx。"""


class CrossTenantAccessError(PermissionError):
    """跨租户访问禁止（13 硬规则 #3）。"""


@dataclass(frozen=True, slots=True)
class TenantContext:
    tenant_id: str  # e.g. 'acme'
    user_id: str  # 发起人（user / service account）
    scopes: tuple[str, ...] = ()
    is_cross_tenant_admin: bool = False

    def __post_init__(self) -> None:
        if not self.tenant_id:
            raise ValueError("TenantContext.tenant_id required")
        if not self.user_id:
            raise ValueError("TenantContext.user_id required")
        # rid 正则中的 tenant 段
        import re
        if not re.match(r"^[a-z0-9_-]{1,64}$", self.tenant_id):
            raise ValueError(
                f"TenantContext.tenant_id must match ^[a-z0-9_-]{{1,64}}$, "
                f"got {self.tenant_id!r}"
            )


_current: ContextVar[Optional[TenantContext]] = ContextVar(
    "mate_kernel_current_tenant", default=None
)


def set_tenant(ctx: TenantContext) -> object:
    """设置当前 ctx（web/middleware/SDK 调用）。"""
    return _current.set(ctx)


def clear_tenant() -> None:
    _current.set(None)


def current_tenant() -> Optional[TenantContext]:
    return _current.get()


def require_tenant() -> TenantContext:
    ctx = _current.get()
    if ctx is None:
        raise MissingTenantContextError(
            "tenant context is required (set via set_tenant before repository access)"
        )
    return ctx


def assert_same_tenant(resource_tenant: str, ctx: TenantContext) -> None:
    """资源 tenant 必须与 ctx tenant 匹配，除非 ctx 是 cross_tenant_admin。"""
    if ctx.tenant_id != resource_tenant and not ctx.is_cross_tenant_admin:
        raise CrossTenantAccessError(
            f"cross-tenant access forbidden: ctx.tenant={ctx.tenant_id} "
            f"resource.tenant={resource_tenant}"
        )


__all__ = [
    "TenantContext",
    "MissingTenantContextError",
    "CrossTenantAccessError",
    "set_tenant",
    "clear_tenant",
    "current_tenant",
    "require_tenant",
    "assert_same_tenant",
]