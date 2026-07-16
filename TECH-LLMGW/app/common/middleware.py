"""Global exception handler wiring for TECH-LLMGW."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.common.context import RequestContext
from app.common.errors import (
    BizException,
    ErrorCode,
    ERROR_HTTP_STATUS,
    InvalidParamError,
    MissingFieldError,
)
from app.common.context import request_context_dep

logger = logging.getLogger("llmgw")


def _envelope(
    code: int,
    message: str,
    data: Any,
    trace_id: str | None,
) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "data": data,
        "traceId": trace_id,
    }


async def _current_trace_id(request: Request) -> str | None:
    # Use the header value as-is; middleware may populate context later.
    return request.headers.get("X-Trace-Id")


def install_exception_handlers(app: FastAPI) -> None:
    """Attach global handlers to ``app``."""

    @app.exception_handler(BizException)
    async def _biz_handler(request: Request, exc: BizException) -> JSONResponse:
        trace_id = await _current_trace_id(request)
        logger.info(
            "biz_exception code=%s message=%s path=%s",
            exc.code,
            exc.message,
            request.url.path,
        )
        return JSONResponse(
            status_code=exc.http_status,
            content=_envelope(int(exc.code), exc.message, exc.data, trace_id),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        trace_id = await _current_trace_id(request)
        # Reduce pydantic noise into a compact data payload.
        errors = [
            {
                "field": ".".join(str(p) for p in err.get("loc", []) if p != "body"),
                "message": err.get("msg", ""),
                "type": err.get("type", ""),
            }
            for err in exc.errors()
        ]
        message = "请求参数校验失败"
        # Distinguish missing field vs invalid value for callers.
        first = errors[0] if errors else {}
        if first.get("type") == "missing":
            envelope = _envelope(
                int(ErrorCode.MISSING_REQUIRED_FIELD),
                message,
                {"errors": errors},
                trace_id,
            )
            return JSONResponse(
                status_code=ERROR_HTTP_STATUS[ErrorCode.MISSING_REQUIRED_FIELD],
                content=envelope,
            )
        envelope = _envelope(
            int(ErrorCode.INVALID_PARAM),
            message,
            {"errors": errors},
            trace_id,
        )
        return JSONResponse(
            status_code=ERROR_HTTP_STATUS[ErrorCode.INVALID_PARAM],
            content=envelope,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        trace_id = await _current_trace_id(request)
        envelope = _envelope(
            exc.status_code,
            str(exc.detail),
            None,
            trace_id,
        )
        return JSONResponse(status_code=exc.status_code, content=envelope)

    @app.exception_handler(Exception)
    async def _generic_handler(request: Request, exc: Exception) -> JSONResponse:
        trace_id = await _current_trace_id(request)
        logger.exception("unhandled exception path=%s", request.url.path)
        envelope = _envelope(
            int(ErrorCode.INTERNAL_ERROR),
            "服务内部错误",
            None,
            trace_id,
        )
        return JSONResponse(
            status_code=ERROR_HTTP_STATUS[ErrorCode.INTERNAL_ERROR],
            content=envelope,
        )


def install_trace_id_middleware(app: FastAPI) -> None:
    """Echo ``X-Trace-Id`` (or a generated one) on every response."""

    @app.middleware("http")
    async def _trace_middleware(request: Request, call_next):
        trace_id = request.headers.get("X-Trace-Id") or _new_trace_id()
        # Stash for handlers.
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["X-Trace-Id"] = trace_id
        return response


def _new_trace_id() -> str:
    import uuid

    return str(uuid.uuid4())