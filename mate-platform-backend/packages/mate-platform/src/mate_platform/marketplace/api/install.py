"""POST /marketplace/install + GET/DELETE /install/{id} + /retry。

鉴权 + tenant 由 SEC-IAM-01 中间件已注入到 request.state。
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status

from ..service.install_service import create_install

router = APIRouter(tags=["marketplace"])


def _require_scope(user, scope: str) -> None:
    if user is None or scope not in getattr(user, "scopes", frozenset()):
        raise HTTPException(
            status_code=403,
            detail={"code": "MP_INSUFFICIENT_SCOPE", "message": f"missing {scope}"},
        )


@router.post("/install", status_code=status.HTTP_202_ACCEPTED)
async def post_install(body: dict, request: Request):
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.write")

    install_id, already = await create_install(
        session=request.state.db,
        kind=body["kind"],
        artifact_id=UUID(body["artifact_id"]),
        version=body["version"],
        installed_by=UUID(user.id),
        tenant_id=UUID(user.tenant_id) if getattr(user, "tenant_id", None) else None,
    )
    # 异步触发 orchestrator(沿用 PLATFORM-EVENT-01 outbox)
    outbox = getattr(request.state, "outbox", None)
    if outbox is not None:
        try:
            await outbox.publish(
                topic="marketplace.install.requested",
                key=str(install_id),
                payload={
                    "install_id": str(install_id),
                    "kind": body["kind"],
                    "artifact_id": body["artifact_id"],
                    "version": body["version"],
                    "license_key": body.get("license_key"),
                },
            )
        except Exception:
            pass
    return {"install_id": str(install_id), "already_installed": already}


@router.get("/install/{install_id}")
async def get_install_status(install_id: UUID, request: Request):
    # 实现 orchestrator 查询(此处仅 stub;真实环境读 installs.repo)
    return {"install_id": str(install_id), "state": "installed"}


@router.delete("/install/{install_id}", status_code=status.HTTP_202_ACCEPTED)
async def uninstall(install_id: UUID, request: Request):
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.write")
    return {"install_id": str(install_id), "state": "uninstalling"}


@router.post(
    "/install/{install_id}/retry", status_code=status.HTTP_202_ACCEPTED
)
async def retry_install(install_id: UUID, request: Request):
    user = getattr(request.state, "user", None)
    _require_scope(user, "platform.marketplace.write")
    return {"install_id": str(install_id), "state": "downloading"}