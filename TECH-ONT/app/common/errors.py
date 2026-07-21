"""Domain errors used by the discovery service."""

from __future__ import annotations


class AppError(Exception):
    """Base application error with a machine-readable code."""

    def __init__(
        self,
        message: str,
        *,
        code: int = 500000,
        status_code: int = 500,
        data: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.data = data or {}


class NotFoundError(AppError):
    def __init__(self, message: str, *, data: dict | None = None) -> None:
        super().__init__(message, code=404000, status_code=404, data=data)


class InvalidParamError(AppError):
    def __init__(self, message: str, *, data: dict | None = None) -> None:
        super().__init__(message, code=400000, status_code=400, data=data)


class ExternalServiceError(AppError):
    def __init__(self, message: str, *, data: dict | None = None) -> None:
        super().__init__(message, code=503000, status_code=503, data=data)
