"""TECH-DATA business error types and codes."""

from __future__ import annotations

from enum import IntEnum
from typing import Any, Optional


class ErrorCode(IntEnum):
    """Business error codes for the data integration service."""

    SUCCESS = 0
    INVALID_PARAM = 40001
    MISSING_REQUIRED_FIELD = 40003
    INVALID_FIELD_VALUE = 40004
    UNSUPPORTED_SOURCE_TYPE = 40007
    TENANT_MISMATCH = 40302
    DATASOURCE_NOT_FOUND = 40401
    SCHEMA_NOT_FOUND = 40402
    QUERY_NOT_FOUND = 40403
    DATASOURCE_NAME_DUPLICATE = 40901
    CONNECTION_TEST_FAILED = 42201
    SCHEMA_DISCOVERY_FAILED = 42202
    INTERNAL_ERROR = 50001
    DATA_SOURCE_ERROR = 50006


# Map error code -> HTTP status. Used by the global exception handler.
ERROR_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.SUCCESS: 200,
    ErrorCode.INVALID_PARAM: 400,
    ErrorCode.MISSING_REQUIRED_FIELD: 400,
    ErrorCode.INVALID_FIELD_VALUE: 400,
    ErrorCode.UNSUPPORTED_SOURCE_TYPE: 400,
    ErrorCode.TENANT_MISMATCH: 403,
    ErrorCode.DATASOURCE_NOT_FOUND: 404,
    ErrorCode.SCHEMA_NOT_FOUND: 404,
    ErrorCode.QUERY_NOT_FOUND: 404,
    ErrorCode.DATASOURCE_NAME_DUPLICATE: 409,
    ErrorCode.CONNECTION_TEST_FAILED: 422,
    ErrorCode.SCHEMA_DISCOVERY_FAILED: 422,
    ErrorCode.INTERNAL_ERROR: 500,
    ErrorCode.DATA_SOURCE_ERROR: 500,
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


class UnsupportedSourceTypeError(BizException):
    code = ErrorCode.UNSUPPORTED_SOURCE_TYPE
    http_status = 400


class TenantMismatchError(BizException):
    code = ErrorCode.TENANT_MISMATCH
    http_status = 403


class DataSourceNotFoundError(BizException):
    code = ErrorCode.DATASOURCE_NOT_FOUND
    http_status = 404


class SchemaNotFoundError(BizException):
    code = ErrorCode.SCHEMA_NOT_FOUND
    http_status = 404


class QueryNotFoundError(BizException):
    code = ErrorCode.QUERY_NOT_FOUND
    http_status = 404


class DataSourceNameDuplicateError(BizException):
    code = ErrorCode.DATASOURCE_NAME_DUPLICATE
    http_status = 409


class ConnectionTestFailedError(BizException):
    code = ErrorCode.CONNECTION_TEST_FAILED
    http_status = 422


class SchemaDiscoveryFailedError(BizException):
    code = ErrorCode.SCHEMA_DISCOVERY_FAILED
    http_status = 422


class DataSourceError(BizException):
    code = ErrorCode.DATA_SOURCE_ERROR
    http_status = 500
