"""AI 模型注册表端点 — 后台「获取模型」清单的 CRUD。

- GET    /api/v1/admin/ai/models          （按 tenant + provider 过滤）
- POST   /api/v1/admin/ai/models          （单条 upsert）
- POST   /api/v1/admin/ai/models/bulk     （批量保存「获取模型」结果）
- PUT    /api/v1/admin/ai/models/{id}     （启用/禁用/改显示名）
- DELETE /api/v1/admin/ai/models/{id}
"""
from __future__ import annotations

import structlog
from datetime import UTC, datetime
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.ai_model import AiModel
from ..services.deps import AdminDep, SessionDep
from .response import ok

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/admin/ai/models", tags=["admin-ai-models"])


# ---- Schemas ----
class AiModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    model_id: str
    display_name: str | None = None
    modality: str = "text"
    enabled: bool = True
    created_at: datetime
    updated_at: datetime


class AiModelIn(BaseModel):
    provider: str = Field(min_length=1, max_length=32)
    model_id: str = Field(min_length=1, max_length=128)
    display_name: str | None = Field(default=None, max_length=256)
    modality: str = Field(default="text", max_length=16)
    enabled: bool = True


class AiModelBulkIn(BaseModel):
    provider: str = Field(min_length=1, max_length=32)
    items: list[AiModelIn]


def _serialize(m: AiModel) -> AiModelOut:
    return AiModelOut(
        id=m.id or 0,
        provider=m.provider,
        model_id=m.model_id,
        display_name=m.display_name,
        modality=m.modality,
        enabled=m.enabled,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


@router.get("")
async def list_ai_models(
    caller: AdminDep,
    session: SessionDep,
    provider: str | None = Query(default=None, max_length=32),
    modality: str | None = Query(default=None, max_length=16),
) -> dict:
    stmt = select(AiModel).where(AiModel.tenant_id == caller.tenant_id)
    if provider:
        stmt = stmt.where(AiModel.provider == provider)
    if modality:
        stmt = stmt.where(AiModel.modality == modality)
    stmt = stmt.order_by(AiModel.provider, AiModel.model_id)
    rows = (await session.scalars(stmt)).all()
    return ok(
        {
            "items": [_serialize(r).model_dump(mode="json") for r in rows],
            "total": len(rows),
        }
    )


@router.post("", status_code=201)
async def upsert_ai_model(caller: AdminDep, session: SessionDep, body: AiModelIn) -> dict:
    existing = (
        await session.scalars(
            select(AiModel).where(
                AiModel.tenant_id == caller.tenant_id,
                AiModel.provider == body.provider,
                AiModel.model_id == body.model_id,
            )
        )
    ).first()
    now = datetime.now(UTC)
    if existing is not None:
        existing.display_name = body.display_name
        existing.modality = body.modality
        existing.enabled = body.enabled
        existing.updated_at = now
        model = existing
    else:
        model = AiModel(
            tenant_id=caller.tenant_id,
            provider=body.provider,
            model_id=body.model_id,
            display_name=body.display_name,
            modality=body.modality,
            enabled=body.enabled,
            created_at=now,
            updated_at=now,
        )
        session.add(model)
    await session.commit()
    await session.refresh(model)
    return ok(_serialize(model).model_dump(mode="json"))


@router.post("/bulk", status_code=201)
async def bulk_save_ai_models(caller: AdminDep, session: SessionDep, body: AiModelBulkIn) -> dict:
    """批量保存「获取模型」结果：同 provider 先清空再写入（全量替换）。"""
    existing = (
        await session.scalars(
            select(AiModel).where(
                AiModel.tenant_id == caller.tenant_id,
                AiModel.provider == body.provider,
            )
        )
    ).all()
    for m in existing:
        await session.delete(m)
    await session.flush()  # 让删除在 PG 层生效，避免插入时唯一约束冲突
    now = datetime.now(UTC)
    created = 0
    for item in body.items:
        session.add(
            AiModel(
                tenant_id=caller.tenant_id,
                provider=body.provider,
                model_id=item.model_id,
                display_name=item.display_name,
                modality=item.modality,
                enabled=item.enabled,
                created_at=now,
                updated_at=now,
            )
        )
        created += 1
    await session.commit()
    return ok({"created": created})


@router.put("/{model_id:int}")
async def update_ai_model(
    caller: AdminDep, session: SessionDep, model_id: int, body: AiModelIn
) -> dict:
    model = await session.get(AiModel, model_id)
    if model is None or model.tenant_id != caller.tenant_id:
        raise HTTPException(status_code=404, detail={"code": "E404", "message": "模型不存在"})
    model.provider = body.provider
    model.model_id = body.model_id
    model.display_name = body.display_name
    model.modality = body.modality
    model.enabled = body.enabled
    model.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(model)
    return ok(_serialize(model).model_dump(mode="json"))


@router.delete("/{model_id:int}")
async def delete_ai_model(caller: AdminDep, session: SessionDep, model_id: int) -> dict:
    model = await session.get(AiModel, model_id)
    if model is None or model.tenant_id != caller.tenant_id:
        raise HTTPException(status_code=404, detail={"code": "E404", "message": "模型不存在"})
    await session.delete(model)
    await session.commit()
    return ok({"deleted": model_id})
