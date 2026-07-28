"""mate-common: Mate Platform 公共基类库

提供:
- 异常基类（领域异常 + 基础设施异常）
- DTO 基类（Pydantic 严格模式）
- 常量定义（错误码、HTTP 状态映射）
- 通用工具（traceId 生成、UUID、租户识别）
"""

from mate_common.dto import BaseDTO, TenantMixin, TimestampMixin
from mate_common.exceptions import (
    AuthError,
    ConflictError,
    DomainError,
    ErrorCode,
    InfraError,
    NotFoundError,
    ValidationError,
)

__version__ = "0.1.0"
__all__ = [
    "AuthError",
    "BaseDTO",
    "ConflictError",
    "DomainError",
    "ErrorCode",
    "InfraError",
    "NotFoundError",
    "TenantMixin",
    "TimestampMixin",
    "ValidationError",
]
