"""TECH-A2A business error types and codes."""

from __future__ import annotations

from enum import IntEnum
from typing import Any, Optional


class ErrorCode(IntEnum):
    """Business error codes for TECH-A2A."""

    SUCCESS = 0
    INVALID_PARAM = 40001
    MISSING_REQUIRED_FIELD = 40003
    INVALID_FIELD_VALUE = 40004
    UNAUTHORIZED = 40101
    FORBIDDEN = 40301
    TENANT_MISMATCH = 40302
    AGENT_NOT_FOUND = 40401
    TASK_NOT_FOUND = 40402
    MESSAGE_NOT_FOUND = 40403
    CARD_NOT_FOUND = 40404
    KEY_NOT_FOUND = 40405
    DUPLICATE_AGENT_CARD = 40901
    AGENT_ALREADY_REGISTERED = 40902
    TASK_ALREADY_COMPLETED = 40903
    INVALID_REQUEST = 42200
    INTERNAL_ERROR = 50001
    UPSTREAM_UNAVAILABLE = 50002


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
    ErrorCode.TASK_NOT_FOUND: 404,
    ErrorCode.MESSAGE_NOT_FOUND: 404,
    ErrorCode.CARD_NOT_FOUND: 404,
    ErrorCode.KEY_NOT_FOUND: 404,
    ErrorCode.DUPLICATE_AGENT_CARD: 409,
    ErrorCode.AGENT_ALREADY_REGISTERED: 409,
    ErrorCode.TASK_ALREADY_COMPLETED: 409,
    ErrorCode.INVALID_REQUEST: 422,
    ErrorCode.INTERNAL_ERROR: 500,
    ErrorCode.UPSTREAM_UNAVAILABLE: 503,
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


class TaskNotFoundError(BizException):
    code = ErrorCode.TASK_NOT_FOUND
    http_status = 404


class MessageNotFoundError(BizException):
    code = ErrorCode.MESSAGE_NOT_FOUND
    http_status = 404


class CardNotFoundError(BizException):
    code = ErrorCode.CARD_NOT_FOUND
    http_status = 404


class KeyNotFoundError(BizException):
    code = ErrorCode.KEY_NOT_FOUND
    http_status = 404


class DuplicateAgentCardError(BizException):
    code = ErrorCode.DUPLICATE_AGENT_CARD
    http_status = 409


class AgentAlreadyRegisteredError(BizException):
    code = ErrorCode.AGENT_ALREADY_REGISTERED
    http_status = 409


class TaskAlreadyCompletedError(BizException):
    code = ErrorCode.TASK_ALREADY_COMPLETED
    http_status = 409


class UpstreamUnavailableError(BizException):
    code = ErrorCode.UPSTREAM_UNAVAILABLE
    http_status = 503


class InvalidRequestError(BizException):
    code = ErrorCode.INVALID_REQUEST
    http_status = 422


class UnauthorizedError(BizException):
    code = ErrorCode.UNAUTHORIZED
    http_status = 401
