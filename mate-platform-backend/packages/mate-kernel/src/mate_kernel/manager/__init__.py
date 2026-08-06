"""manager 模块导出。"""

from .protocol import (
    ChangeKind,
    ChangeSink,
    Manager,
    ManagerContext,
    ManagerError,
    ManagerLimits,
    NullChangeSink,
    TenantMismatchError,
    TrackedChange,
)

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
