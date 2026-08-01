"""版本管理 API (ST-5.4.8)."""
from __future__ import annotations

import dataclasses

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .store import version_store

router = APIRouter(prefix="/api/v1/ont/versions", tags=["versioning"])


class VersionCreate(BaseModel):
    ontology_id: str
    version: str
    parent: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class VersionResponse(BaseModel):
    version_id: str
    ontology_id: str
    version: str
    parent: str | None = None
    created_at: float
    metadata: dict[str, str] = Field(default_factory=dict)


@router.post("", response_model=VersionResponse)
async def create_version(payload: VersionCreate) -> VersionResponse:
    """创建版本快照."""
    try:
        v = version_store.create(
            payload.ontology_id,
            payload.version,
            parent=payload.parent,
            metadata=payload.metadata,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return VersionResponse(**dataclasses.asdict(v))


@router.get("", response_model=list[VersionResponse])
async def list_versions(ontology_id: str | None = None) -> list[VersionResponse]:
    """列出版本(可选按 ontology_id 过滤)."""
    if ontology_id:
        versions = version_store.list_for_ontology(ontology_id)
    else:
        versions = version_store.list_all()
    return [VersionResponse(**dataclasses.asdict(v)) for v in versions]


@router.get("/{version_id}", response_model=VersionResponse)
async def get_version(version_id: str) -> VersionResponse:
    """获取版本详情."""
    v = version_store.get_by_id(version_id)
    if v is None:
        raise HTTPException(status_code=404, detail="version not found")
    return VersionResponse(**dataclasses.asdict(v))


@router.delete("/{version_id}")
async def delete_version(version_id: str) -> dict[str, bool]:
    """删除版本."""
    deleted = version_store.delete_by_id(version_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="version not found")
    return {"deleted": True}
