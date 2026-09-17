"""mate_tech_agent_team.main — FastAPI 应用工厂。

挂载 ``/api/v1/agent-team/*``（contracts/openapi/services/agent-team.yaml）。

服务层通过 :func:`mate_tech_agent_team.api.app.set_brain_service` 注入：
生产由 lifespan 按环境变量装配（见 :mod:`mate_tech_agent_team.wiring`），
测试直接 ``create_app(service=...)``。
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from mate_platform.auth import install_auth

from .api.app import (
    get_run_control,
    router,
    set_artifact_store,
    set_brain_service,
    set_profile_registry,
    set_profile_store,
    set_run_control,
    set_skill_catalog,
    set_team_bus,
)
from .artifact_store import ArtifactStore
from .brain import BrainService
from .profile_store import ProfileStore
from .profiles import ProfileRegistry
from .team_bus import TeamBus

SERVICE_NAME = "mate-tech-agent-team"

logger = logging.getLogger(__name__)


def _healthz() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    from .wiring import (
        build_artifact_store,
        build_profile_store,
        build_registry,
        build_service,
        build_skill_catalog,
        build_team_bus,
    )

    # 1.1 任务 3：名册接 PG —— 建出来的员工随重启/多副本一致（内置定义仍在代码里）。
    # 名册只有一份：HTTP 面与派活闸门读同一个。
    store = build_profile_store()
    registry = build_registry(store)
    # 1.2 任务 2：派活闸门同时是消息通道。**先建它再建服务**——HTTP 的 send 与
    # 员工侧的 drain 必须落在同一个实例上，否则等于两个信箱。
    bus = build_team_bus(registry)
    # 1.6 任务 2：产出物落 PG。HTTP 面的取回与图里的落库必须是**同一个实例**，
    # 否则图写进一个库、接口从另一个读，两边各说各话。
    artifacts = build_artifact_store()
    service = build_service(registry=registry, team_bus=bus, artifacts=artifacts)
    set_brain_service(service)
    set_profile_registry(registry)
    set_skill_catalog(build_skill_catalog())
    set_team_bus(bus)
    # 1.3 轨 2：建/改数字员工的落库面（与名册读的是同一张表）。
    set_profile_store(store)
    set_artifact_store(artifacts)
    set_run_control(None)  # 按当前服务层现建：运行控制面没有独立状态要注入
    app.state.brain_service = service
    app.state.team_bus = bus
    # 1.8 轨 1：把上一次进程没跑完的 run 接着跑完。**不阻塞启动**（认领后交给
    # 后台任务），且扫不动时只记一条日志——恢复是兜底能力，不该拦住服务起来。
    try:
        await get_run_control().recover()
    except Exception:
        logger.exception("启动扫描没跑成：在途 run 本次不会被自动续跑")
    yield
    # 收尾：拆掉在途的后台任务。取消**不落终态**——它们会被下一次启动扫描认领。
    try:
        await get_run_control().shutdown()
    except Exception:
        logger.exception("收尾时拆后台任务失败")
    set_brain_service(None)
    set_profile_registry(None)
    set_skill_catalog(None)
    set_team_bus(None)
    set_profile_store(None)
    set_artifact_store(None)
    set_run_control(None)


def create_app(
    service: BrainService | None = None,
    *,
    with_wiring: bool = False,
    team_bus: TeamBus | None = None,
    profile_store: ProfileStore | None = None,
    profile_registry: ProfileRegistry | None = None,
    artifact_store: ArtifactStore | None = None,
) -> FastAPI:
    """构造应用。

    ``service`` 省略时不装配服务层（便于单测自行注入）；
    ``with_wiring=True`` 时由 lifespan 按环境变量装配生产实现。
    ``team_bus`` 给测试注入消息通道（省略时依赖 lifespan 或 ``set_team_bus``）；
    ``profile_store`` / ``profile_registry`` 注入员工读写面与名册；
    ``artifact_store`` 注入产出物存储（1.6 任务 2）。
    """
    app = FastAPI(
        title=SERVICE_NAME,
        version="2.1.0",
        description="Agent 产品层 2.1：超级大脑（langgraph 任务图）+ 数字员工",
        lifespan=_lifespan if with_wiring else None,
    )
    install_auth(app, extra_anonymous_paths={"/healthz"})
    app.add_api_route("/healthz", _healthz, methods=["GET"])
    app.include_router(router)
    if service is not None:
        set_brain_service(service)
    if team_bus is not None:
        set_team_bus(team_bus)
    if profile_registry is not None:
        set_profile_registry(profile_registry)
    if profile_store is not None:
        set_profile_store(profile_store)
    if artifact_store is not None:
        set_artifact_store(artifact_store)
    return app


app = create_app(with_wiring=True)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8013")))
