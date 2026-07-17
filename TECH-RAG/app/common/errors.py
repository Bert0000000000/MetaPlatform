"""TECH-RAG business error types and codes."""

from __future__ import annotations

from enum import IntEnum
from typing import Any, Optional


class ErrorCode(IntEnum):
    """Business error codes for the RAG engine service.

    Aligned with SPEC-TECH-RAG-RAG引擎API规范_v1.0 §2.5.2.
    """

    SUCCESS = 0
    INVALID_PARAM = 40001
    MISSING_REQUIRED_FIELD = 40003
    INVALID_FIELD_VALUE = 40004
    UNSUPPORTED_FILE_TYPE = 40005
    FILE_TOO_LARGE = 40006
    TENANT_MISMATCH = 40302
    KB_NOT_FOUND = 40401
    DOCUMENT_NOT_FOUND = 40402
    KB_ALREADY_EXISTS = 40901
    DOCUMENT_ALREADY_EXISTS = 40902
    KB_NOT_EMPTY = 40903
    INTERNAL_ERROR = 50001
    DATABASE_ERROR = 50002
    LLMGW_ERROR = 50003
    EMBEDDING_FAILED = 50004
    ONTOLOGY_ERROR = 50005
    CITATION_NOT_FOUND = 40403


# Map error code -> HTTP status. Used by the global exception handler.
ERROR_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.SUCCESS: 200,
    ErrorCode.INVALID_PARAM: 400,
    ErrorCode.MISSING_REQUIRED_FIELD: 400,
    ErrorCode.INVALID_FIELD_VALUE: 400,
    ErrorCode.UNSUPPORTED_FILE_TYPE: 400,
    ErrorCode.FILE_TOO_LARGE: 400,
    ErrorCode.TENANT_MISMATCH: 403,
    ErrorCode.KB_NOT_FOUND: 404,
    ErrorCode.DOCUMENT_NOT_FOUND: 404,
    ErrorCode.CITATION_NOT_FOUND: 404,
    ErrorCode.KB_ALREADY_EXISTS: 409,
    ErrorCode.DOCUMENT_ALREADY_EXISTS: 409,
    ErrorCode.KB_NOT_EMPTY: 409,
    ErrorCode.INTERNAL_ERROR: 500,
    ErrorCode.DATABASE_ERROR: 500,
    ErrorCode.LLMGW_ERROR: 502,
    ErrorCode.EMBEDDING_FAILED: 500,
    ErrorCode.ONTOLOGY_ERROR: 502,
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


class UnsupportedFileTypeError(BizException):
    code = ErrorCode.UNSUPPORTED_FILE_TYPE
    http_status = 400


class FileTooLargeError(BizException):
    code = ErrorCode.FILE_TOO_LARGE
    http_status = 400


class TenantMismatchError(BizException):
    code = ErrorCode.TENANT_MISMATCH
    http_status = 403


class KnowledgeBaseNotFoundError(BizException):
    code = ErrorCode.KB_NOT_FOUND
    http_status = 404


class DocumentNotFoundError(BizException):
    code = ErrorCode.DOCUMENT_NOT_FOUND
    http_status = 404


class KnowledgeBaseAlreadyExistsError(BizException):
    code = ErrorCode.KB_ALREADY_EXISTS
    http_status = 409


class DocumentAlreadyExistsError(BizException):
    code = ErrorCode.DOCUMENT_ALREADY_EXISTS
    http_status = 409


class KnowledgeBaseNotEmptyError(BizException):
    code = ErrorCode.KB_NOT_EMPTY
    http_status = 409


class DatabaseError(BizException):
    code = ErrorCode.DATABASE_ERROR
    http_status = 500


class LLMGWError(BizException):
    code = ErrorCode.LLMGW_ERROR
    http_status = 502


class EmbeddingFailedError(BizException):
    code = ErrorCode.EMBEDDING_FAILED
    http_status = 500


class OntologyError(BizException):
    code = ErrorCode.ONTOLOGY_ERROR
    http_status = 502


class CitationNotFoundError(BizException):
    code = ErrorCode.CITATION_NOT_FOUND
    http_status = 404
