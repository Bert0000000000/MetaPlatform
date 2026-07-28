"""异常基类

设计原则（v3.0 Plan D）：
- DomainError: 业务规则违反（HTTP 400 / 422）
- InfraError: 基础设施失败（HTTP 502 / 503）
- AuthError: 鉴权失败（HTTP 401 / 403）
- 错误码统一管理，便于前端处理
"""

from __future__ import annotations

from enum import StrEnum


class ErrorCode(StrEnum):
    """统一错误码（前缀分类）"""

    # 业务错误 (4xx)
    VALIDATION_FAILED = "E400_VALIDATION"
    NOT_FOUND = "E404_NOT_FOUND"
    CONFLICT = "E409_CONFLICT"
    UNAUTHORIZED = "E401_UNAUTHORIZED"
    FORBIDDEN = "E403_FORBIDDEN"
    BUSINESS_RULE_VIOLATION = "E422_BUSINESS"

    # 基础设施错误 (5xx)
    INFRA_TIMEOUT = "E502_TIMEOUT"
    INFRA_UNAVAILABLE = "E503_UNAVAILABLE"
    INFRA_BAD_RESPONSE = "E502_BAD_RESPONSE"
    DATABASE_ERROR = "E500_DATABASE"
    EXTERNAL_SERVICE_ERROR = "E502_EXTERNAL"


class DomainError(Exception):
    """领域错误基类（业务规则违反）"""

    code: ErrorCode = ErrorCode.BUSINESS_RULE_VIOLATION
    http_status: int = 422
    message: str = "Domain rule violation"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.details = details or {}

    def to_dict(self) -> dict[str, object]:
        return {
            "code": self.code.value,
            "message": self.message,
            "details": self.details,
        }


class NotFoundError(DomainError):
    code: ErrorCode = ErrorCode.NOT_FOUND
    http_status: int = 404
    message: str = "Resource not found"


class ConflictError(DomainError):
    code: ErrorCode = ErrorCode.CONFLICT
    http_status: int = 409
    message: str = "Resource conflict"


class ValidationError(DomainError):
    code: ErrorCode = ErrorCode.VALIDATION_FAILED
    http_status: int = 400
    message: str = "Validation failed"


class AuthError(DomainError):
    code: ErrorCode = ErrorCode.UNAUTHORIZED
    http_status: int = 401
    message: str = "Authentication failed"


class InfraError(Exception):
    """基础设施错误基类（外部服务/数据库失败）"""

    code: ErrorCode = ErrorCode.INFRA_UNAVAILABLE
    http_status: int = 503
    message: str = "Infrastructure unavailable"

    def __init__(
        self,
        message: str | None = None,
        *,
        service: str | None = None,
        original: Exception | None = None,
        details: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.service = service
        self.original = original
        self.details = details or {}

    def to_dict(self) -> dict[str, object]:
        result: dict[str, object] = {
            "code": self.code.value,
            "message": self.message,
            "details": self.details,
        }
        if self.service:
            result["service"] = self.service
        return result
