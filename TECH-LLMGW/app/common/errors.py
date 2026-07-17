"""TECH-LLMGW business error types and codes."""

from __future__ import annotations

from enum import IntEnum
from typing import Any, Optional


class ErrorCode(IntEnum):
    """Phase 2 business error codes. Full set is defined in the master SPEC."""

    SUCCESS = 0
    INVALID_PARAM = 40001
    MISSING_REQUIRED_FIELD = 40003
    INVALID_FIELD_VALUE = 40004
    UNSUPPORTED_MODEL_TYPE = 40005
    UNSUPPORTED_MODALITY = 40006
    UNAUTHORIZED = 40101
    TENANT_MISMATCH = 40302
    PROVIDER_NOT_FOUND = 40401
    MODEL_NOT_FOUND = 40402
    PROMPT_NOT_FOUND = 40404
    QUOTA_NOT_FOUND = 40405
    RATE_LIMIT_NOT_FOUND = 40406
    PROMPT_KEY_EXISTS = 40903
    INVALID_REQUEST = 42200
    MODEL_NOT_AVAILABLE = 42202
    ALL_PROVIDERS_FAILED = 42203
    PROMPT_VARIABLE_MISSING = 42205
    PROMPT_RENDER_FAILED = 42206
    RATE_LIMIT_EXCEEDED = 42901
    INTERNAL_ERROR = 50001
    PROVIDER_API_ERROR = 50005


# Map error code -> HTTP status. Used by the global exception handler.
ERROR_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.SUCCESS: 200,
    ErrorCode.INVALID_PARAM: 400,
    ErrorCode.MISSING_REQUIRED_FIELD: 400,
    ErrorCode.INVALID_FIELD_VALUE: 400,
    ErrorCode.UNSUPPORTED_MODEL_TYPE: 400,
    ErrorCode.UNSUPPORTED_MODALITY: 400,
    ErrorCode.UNAUTHORIZED: 401,
    ErrorCode.TENANT_MISMATCH: 403,
    ErrorCode.PROVIDER_NOT_FOUND: 404,
    ErrorCode.MODEL_NOT_FOUND: 404,
    ErrorCode.PROMPT_NOT_FOUND: 404,
    ErrorCode.QUOTA_NOT_FOUND: 404,
    ErrorCode.RATE_LIMIT_NOT_FOUND: 404,
    ErrorCode.PROMPT_KEY_EXISTS: 409,
    ErrorCode.INVALID_REQUEST: 422,
    ErrorCode.MODEL_NOT_AVAILABLE: 422,
    ErrorCode.ALL_PROVIDERS_FAILED: 422,
    ErrorCode.PROMPT_VARIABLE_MISSING: 422,
    ErrorCode.PROMPT_RENDER_FAILED: 422,
    ErrorCode.RATE_LIMIT_EXCEEDED: 429,
    ErrorCode.INTERNAL_ERROR: 500,
    ErrorCode.PROVIDER_API_ERROR: 500,
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


class UnsupportedModelTypeError(BizException):
    code = ErrorCode.UNSUPPORTED_MODEL_TYPE
    http_status = 400


class UnsupportedModalityError(BizException):
    code = ErrorCode.UNSUPPORTED_MODALITY
    http_status = 400


class TenantMismatchError(BizException):
    code = ErrorCode.TENANT_MISMATCH
    http_status = 403


class ProviderNotFoundError(BizException):
    code = ErrorCode.PROVIDER_NOT_FOUND
    http_status = 404


class ModelNotFoundError(BizException):
    code = ErrorCode.MODEL_NOT_FOUND
    http_status = 404


class ModelNotAvailableError(BizException):
    code = ErrorCode.MODEL_NOT_AVAILABLE
    http_status = 422


class AllProvidersFailedError(BizException):
    code = ErrorCode.ALL_PROVIDERS_FAILED
    http_status = 422


class ProviderApiError(BizException):
    code = ErrorCode.PROVIDER_API_ERROR
    http_status = 500


class UnauthorizedError(BizException):
    code = ErrorCode.UNAUTHORIZED
    http_status = 401


class InvalidRequestError(BizException):
    code = ErrorCode.INVALID_REQUEST
    http_status = 422


class PromptNotFoundError(BizException):
    code = ErrorCode.PROMPT_NOT_FOUND
    http_status = 404


class PromptKeyExistsError(BizException):
    code = ErrorCode.PROMPT_KEY_EXISTS
    http_status = 409


class PromptVariableMissingError(BizException):
    code = ErrorCode.PROMPT_VARIABLE_MISSING
    http_status = 422


class PromptRenderFailedError(BizException):
    code = ErrorCode.PROMPT_RENDER_FAILED
    http_status = 422


class QuotaNotFoundError(BizException):
    code = ErrorCode.QUOTA_NOT_FOUND
    http_status = 404


class RateLimitNotFoundError(BizException):
    code = ErrorCode.RATE_LIMIT_NOT_FOUND
    http_status = 404


class RateLimitExceededError(BizException):
    code = ErrorCode.RATE_LIMIT_EXCEEDED
    http_status = 429