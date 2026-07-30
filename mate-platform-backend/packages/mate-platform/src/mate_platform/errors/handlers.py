from typing import Any


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
