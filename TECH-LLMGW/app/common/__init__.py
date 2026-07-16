"""TECH-LLMGW common utilities (response envelope, errors)."""

from app.common.api_response import ApiResponse, PageResponse, success, fail
from app.common.errors import (
    BizException,
    ErrorCode,
    InvalidParamError,
    MissingFieldError,
    InvalidFieldValueError,
    UnsupportedModelTypeError,
    UnsupportedModalityError,
    TenantMismatchError,
    ProviderNotFoundError,
    ModelNotFoundError,
    ModelNotAvailableError,
    AllProvidersFailedError,
    ProviderApiError,
)

__all__ = [
    "ApiResponse",
    "PageResponse",
    "success",
    "fail",
    "BizException",
    "ErrorCode",
    "InvalidParamError",
    "MissingFieldError",
    "InvalidFieldValueError",
    "UnsupportedModelTypeError",
    "UnsupportedModalityError",
    "TenantMismatchError",
    "ProviderNotFoundError",
    "ModelNotFoundError",
    "ModelNotAvailableError",
    "AllProvidersFailedError",
    "ProviderApiError",
]