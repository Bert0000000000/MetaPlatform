"""GET /marketplace/browse + /artifacts/{kind}/{id} — SaaS 检索代理。"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

router = APIRouter(tags=["marketplace"])


@router.get("/browse")
async def list_artifacts(
    request: Request,
    kind: str = Query(..., pattern="^(mcp|agent|ontology|skill)$"),
    q: str | None = None,
    tag: str | None = None,
    page: int = 1,
):
    """浏览市场列表(SaaS 检索代理 + 本地已安装标注)。"""
    client = request.state.marketplace_client
    try:
        return await client.list_artifacts(
            kind=kind, q=q, tag=tag, page=page
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "MP_SAAS_UNREACHABLE", "message": str(e)},
        )


@router.get("/artifacts/{kind}/{artifact_id}")
async def get_artifact(
    request: Request,
    kind: str,
    artifact_id: UUID,
):
    client = request.state.marketplace_client
    try:
        return await client.get_artifact(
            kind=kind, artifact_id=str(artifact_id)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "MP_SAAS_UNREACHABLE", "message": str(e)},
        )