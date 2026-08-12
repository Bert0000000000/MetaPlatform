"""mate-app-hub marketplace 挂载 — 把 mate_platform.marketplace 域接入 apphub 服务。

marketplace 路由（browse/install/installed）统一以 /api/v1/marketplace 前缀挂载，
由 gateway ROUTE_MAP 的 ("/api/v1/marketplace/", "apphub") 转发至此。

接线（与 mate_tech_db 同步 Session 对齐）：
  - DB session：router dependency 在请求级创建（get_session），确保 AuthMiddleware 之后执行
  - request.state.user：从 SEC-IAM-01 的 ctx 映射（超级管理员授予 marketplace 全 scope）
  - request.state.outbox：app.state.outbox_writer（InMemoryOutboxWriter）
  - request.state.marketplace_client：browse 用（内存 stub）
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, Request

logger = structlog.get_logger(__name__)

# marketplace 三个子 router（各自裸路径，统一加前缀）
from mate_platform.marketplace.api import browse as _browse
from mate_platform.marketplace.api import install as _install
from mate_platform.marketplace.api import installed as _installed
from mate_platform.marketplace.skillhub import api as _skillhub


class _StubMarketplaceClient:
    """browse 的最小客户端 — 无外部 registry，返回空。"""

    async def search(self, *args, **kwargs):
        return {"items": [], "total": 0}

    async def get_artifact(self, *args, **kwargs):
        return None


class _UserProxy:
    """把 SEC-IAM-01 的 request.state.ctx 映射成 marketplace 端点的 user 形状。

    marketplace 端点读取 user.scopes / user.id / user.tenant_id。
    """

    def __init__(self, *, id: str, tenant_id: str, scopes: frozenset) -> None:
        self.id = id
        self.tenant_id = tenant_id
        self.scopes = scopes


async def _inject_marketplace_state(request: Request):
    """请求级注入 marketplace 所需的 request.state 上下文。

    以 router dependency 形式（而非 middleware）注册，确保在
    AuthMiddleware 之后执行（此时 request.state.ctx 已被填充）。
    """
    from mate_tech_db.base import get_session, create_all
    try:
        create_all()
    except Exception as exc:  # noqa: BLE001
        logger.warning("marketplace.create_all_failed", error=str(exc))

    session = get_session()
    request.state.db = session
    request.state.outbox = getattr(
        request.app.state, "outbox_writer", None
    )
    request.state.marketplace_client = getattr(
        request.app.state, "marketplace_client", _StubMarketplaceClient()
    )
    # marketplace 端点读 request.state.user（.scopes/.id/.tenant_id）
    ctx = getattr(request.state, "ctx", None)
    if ctx is not None:
        scopes = set(getattr(ctx, "scopes", frozenset()))
        # 超级管理员自动授予 marketplace 全 scope（治理面已由 IAM 校验角色）
        if "PLATFORM_SUPER_ADMIN" in getattr(ctx, "roles", frozenset()):
            scopes.update(
                {"platform.marketplace.write", "platform.marketplace.read", "platform.marketplace.read.tenant"}
            )
        request.state.user = _UserProxy(
            id=str(getattr(ctx, "user_id", "") or ""),
            tenant_id=str(getattr(ctx, "tenant_id", "") or ""),
            scopes=frozenset(scopes),
        )
    try:
        yield
    finally:
        session.close()


router = APIRouter(
    prefix="/api/v1/marketplace",
    tags=["marketplace"],
    dependencies=[Depends(_inject_marketplace_state)],
)

router.include_router(_browse.router)
router.include_router(_install.router)
router.include_router(_installed.router)
router.include_router(_skillhub.router)


def install_marketplace_state(app) -> None:
    """在 app 上初始化 marketplace 所需状态（client + outbox）。"""
    from mate_platform.messaging.outbox import InMemoryOutboxWriter

    if not hasattr(app.state, "marketplace_client"):
        app.state.marketplace_client = _StubMarketplaceClient()
    if not hasattr(app.state, "outbox_writer"):
        app.state.outbox_writer = InMemoryOutboxWriter()
    logger.info("marketplace.state.installed")
