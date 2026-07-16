"""Pydantic schemas for the Model domain."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ModelType(str, Enum):
    CHAT = "CHAT"
    EMBEDDING = "EMBEDDING"
    MULTIMODAL = "MULTIMODAL"


class ModelCapability(str, Enum):
    CHAT = "CHAT"
    VISION = "VISION"
    EMBEDDING = "EMBEDDING"
    FUNCTION_CALLING = "FUNCTION_CALLING"
    RERANK = "RERANK"


class ModelSpec(BaseModel):
    """Hardcoded catalog entry describing a known model."""

    provider: str
    code: str
    display_name: str
    type: ModelType
    context_length: int = 0
    input_price: float = 0.0
    output_price: float = 0.0
    capabilities: List[ModelCapability] = Field(default_factory=list)
    description: str = ""


class Model(BaseModel):
    """Persisted model record (in-memory in Phase 2)."""

    model_id: str
    tenant_id: str
    provider: str
    model_code: str
    display_name: str
    type: ModelType
    input_price: float = 0.0
    output_price: float = 0.0
    context_length: int = 0
    capabilities: List[str] = Field(default_factory=list)
    enabled: bool = True
    description: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ModelListItem(BaseModel):
    modelId: str
    tenantId: str
    provider: str
    modelCode: str
    displayName: str
    type: ModelType
    inputPrice: float
    outputPrice: float
    contextLength: int
    capabilities: List[str]
    enabled: bool
    description: str
    createdAt: datetime
    updatedAt: datetime


class ModelDetail(ModelListItem):
    """Alias kept for readability; spec calls for the same payload."""


class SyncModelsRequest(BaseModel):
    providers: Optional[List[str]] = None


class ProviderSyncStat(BaseModel):
    provider: str
    fetched: int
    added: int
    updated: int
    removed: int


class SyncModelsResponse(BaseModel):
    syncedAt: datetime
    providers: List[ProviderSyncStat]
    total: int


def to_list_item(model: Model) -> dict:
    return {
        "modelId": model.model_id,
        "tenantId": model.tenant_id,
        "provider": model.provider,
        "modelCode": model.model_code,
        "displayName": model.display_name,
        "type": model.type.value if isinstance(model.type, ModelType) else model.type,
        "inputPrice": model.input_price,
        "outputPrice": model.output_price,
        "contextLength": model.context_length,
        "capabilities": list(model.capabilities),
        "enabled": model.enabled,
        "description": model.description,
        "createdAt": model.created_at,
        "updatedAt": model.updated_at,
    }


def model_to_detail(model: Model) -> dict:
    # Same shape as list item in Phase 2; alias kept for future expansion.
    return to_list_item(model)