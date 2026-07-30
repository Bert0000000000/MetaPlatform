from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from .config import PlatformSettings
from .errors.handlers import PlatformError, to_http_response
from .observability import setup_tracing


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = PlatformSettings()
    setup_tracing(settings.service_name, otlp_endpoint="")
    yield


def create_app(title: str) -> FastAPI:
    app = FastAPI(title=title, lifespan=lifespan)

    @app.exception_handler(PlatformError)
    async def _handle(_: object, exc: PlatformError):  # type: ignore[no-redef]
        body, status = to_http_response(exc, request_id="")
        return body, status

    return app
