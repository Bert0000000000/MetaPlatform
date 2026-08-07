"""AI 模型注册表 — 后台「获取模型」拉回的模型清单持久化。

SuperAI 聊天框 / 数字员工模型选择从这张表读取可用模型。
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Index, String
from sqlmodel import Field, SQLModel


class AiModel(SQLModel, table=True):
    """单个可用的 AI 模型条目（provider + model 维度）。"""

    __tablename__ = "ai_model"
    __table_args__ = (
        Index("ix_ai_model_tenant_provider", "tenant_id", "provider"),
        Index("ix_ai_model_tenant_model", "tenant_id", "model_id", unique=True),
    )

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    provider: str = Field(max_length=32, description="openai/azure/ollama/custom")
    model_id: str = Field(max_length=128, description="模型名，如 MiniMax-M3")
    display_name: str | None = Field(default=None, max_length=256)
    modality: str = Field(default="text", max_length=16, description="text/multimodal")
    enabled: bool = Field(default=True, sa_column=Column(Boolean, default=True))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True)),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True)),
    )
