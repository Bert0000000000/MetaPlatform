"""FastAPI application entry point for TECH-ONT discovery service."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.v1.router import router as v1_router
from app.common.api_response import fail
from app.common.errors import AppError

app = FastAPI(
    title="TECH-ONT Discovery",
    description="Ontology auto-discovery service for Mate Platform",
    version="0.1.0",
)


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    body = fail(
        exc.code,
        exc.message,
        data=exc.data,
        http_status=exc.status_code,
    )
    status = body.pop("_httpStatus")
    return JSONResponse(status_code=status, content=body)


app.include_router(v1_router)
