"""TECH-AGENT business error types and codes."""

from __future__ import annotations

from enum import IntEnum
from typing import Any, Optional


class ErrorCode(IntEnum):
    """Business error codes for TECH-AGENT."""

    SUCCESS = 0
    INVALID_PARAM = 40001
    MISSING_REQUIRED_FIELD = 40003
    INVALID_FIELD_VALUE = 40004
    UNAUTHORIZED = 40101
    FORBIDDEN = 40301
    TENANT_MISMATCH = 40302
    AGENT_NOT_FOUND = 40401
    DUPLICATE_AGENT_CODE = 40901
    AGENT_NOT_ACTIVE = 40902
    INVALID_REQUEST = 42200
    INTERNAL_ERROR = 50001
    LLMGW_UNAVAILABLE = 50002


# Map error code -> HTTP status. Used by the global exception handler.
ERROR_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.SUCCESS: 200,
    ErrorCode.INVALID_PARAM: 400,
    ErrorCode.MISSING_REQUIRED_FIELD: 400,
    ErrorCode.INVALID_FIELD_VALUE: 400,
    ErrorCode.UNAUTHORIZED: 401,
    ErrorCode.FORBIDDEN: 403,
    ErrorCode.TENANT_MISMATCH: 403,
    ErrorCode.AGENT_NOT_FOUND: 404,
    ErrorCode.DUPLICATE_AGENT_CODE: 409,
    ErrorCode.AGENT_NOT_ACTIVE: 409,
    ErrorCode.INVALID_REQUEST: 422,
    ErrorCode.INTERNAL_ERROR: 500,
    ErrorCode.LLMGW_UNAVAILABLE: 503,
}


class BizException(Exception):
    """Base business exception carrying an error code and HTTP status."""

    code: ErrorCode = ErrorCode.INTERNAL_ERROR
    http_status: int = 500

    def __init__(
        self,
        message: str,
        *,
        code: Optional[ErrorCode] = None,
        http_status: Optional[int] = None,
        data: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.http_status = http_status or ERROR_HTTP_STATUS.get(self.code, 500)
        self.data = data


class InvalidParamError(BizException):
    code = ErrorCode.INVALID_PARAM
    http_status = 400


class MissingFieldError(BizException):
    code = ErrorCode.MISSING_REQUIRED_FIELD
    http_status = 400


class InvalidFieldValueError(BizException):
    code = ErrorCode.INVALID_FIELD_VALUE
    http_status = 400


class TenantMismatchError(BizException):
    code = ErrorCode.TENANT_MISMATCH
    http_status = 403


class ForbiddenError(BizException):
    code = ErrorCode.FORBIDDEN
    http_status = 403


class AgentNotFoundError(BizException):
    code = ErrorCode.AGENT_NOT_FOUND
    http_status = 404


class DuplicateAgentCodeError(BizException):
    code = ErrorCode.DUPLICATE_AGENT_CODE
    http_status = 409


class AgentNotActiveError(BizException):
    code = ErrorCode.AGENT_NOT_ACTIVE
    http_status = 409


class LLMGWUnavailableError(BizException):
    code = ErrorCode.LLMGW_UNAVAILABLE
    http_status = 503


class InvalidRequestError(BizException):
    code = ErrorCode.INVALID_REQUEST
    http_status = 422


class UnauthorizedError(BizException):
    code = ErrorCode.UNAUTHORIZED
    http_status = 401
