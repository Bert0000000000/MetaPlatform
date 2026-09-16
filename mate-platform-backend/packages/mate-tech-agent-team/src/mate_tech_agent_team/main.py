"""mate_tech_agent_team.main — FastAPI 应用工厂。

挂载 ``/api/v1/agent-team/*``（contracts/openapi/services/agent-team.yaml）。

服务层通过 :func:`mate_tech_agent_team.api.app.set_brain_service` 注入：
生产由 lifespan 按环境变量装配（见 :mod:`mate_tech_agent_team.wiring`），
测试直接 ``create_app(service=...)``。
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api.app import router, set_brain_service
from .brain import BrainService

SERVICE_NAME = "mate-tech-agent-team"


def _healthz() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    from .wiring import build_service

    service = build_service()
    set_brain_service(service)
    app.state.brain_service = service
    yield
    set_brain_service(None)


def create_app(service: BrainService | None = None, *, with_wiring: bool = False) -> FastAPI:
    """构造应用。

    ``service`` 省略时不装配服务层（便于单测自行注入）；
    ``with_wiring=True`` 时由 lifespan 按环境变量装配生产实现。
    """
    app = FastAPI(
        title=SERVICE_NAME,
        version="0.1.0",
        description="Agent 产品层 1.0：超级大脑（langgraph 任务图）+ 数字员工",
        lifespan=_lifespan if with_wiring else None,
    )
    install_auth(app, extra_anonymous_paths={"/healthz"})
    app.add_api_route("/healthz", _healthz, methods=["GET"])
    app.include_router(router)
    if service is not None:
        set_brain_service(service)
    return app


app = create_app(with_wiring=True)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8013")))
