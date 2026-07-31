from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

from ..tenancy.guards import TenantAccessError


class PlatformError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def to_http_response(err: PlatformError, *, request_id: str) -> tuple[dict[str, Any], int]:
    return (
        {"code": err.code, "message": err.message, "requestId": request_id},
        err.status,
    )


async def tenant_access_error_handler(
    request: Request, exc: TenantAccessError
) -> JSONResponse:
    """Map TenantAccessError to a 400 Bad Request with a structured body.

    Without this handler the exception propagates to Starlette and
    surfaces as a 500 Server Error. require_tenant() raises this on
    anonymous callers or missing tenant bindings (hard rule 3); a
    missing tenant context is a client error, not a server fault.
    """
    return JSONResponse(
        status_code=400,
        content={
            "error": "TENANT_ACCESS_DENIED",
            "message": str(exc),
            "code": "E_TENANT_REQUIRED",
        },
    )
