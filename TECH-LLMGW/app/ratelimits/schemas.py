"""Pydantic schemas for the Rate Limit domain (P1-LLMGW-07/08)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RateLimitScope(str, Enum):
    GLOBAL = "GLOBAL"
    USER = "USER"
    APP = "APP"
    MODEL = "MODEL"


class RateLimitType(str, Enum):
    RPM = "RPM"
    TPM = "TPM"


class RateLimitStatus(str, Enum):
    ENABLED = "ENABLED"
    DISABLED = "DISABLED"


class RateLimitCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    scope: RateLimitScope
    targetId: str = Field(..., min_length=1)
    type: RateLimitType
    limitValue: int = Field(..., ge=1)
    windowSeconds: int = Field(default=60, ge=1)
    enabled: bool = Field(default=True)


class RateLimitUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    limitValue: Optional[int] = Field(default=None, ge=1)
    windowSeconds: Optional[int] = Field(default=None, ge=1)
    enabled: Optional[bool] = Field(default=None)


class RateLimitRecord(BaseModel):
    """Internal persisted rate limit record."""

    rate_limit_id: str
    tenant_id: str
    name: str
    scope: RateLimitScope
    target_id: str
    type: RateLimitType
    limit_value: int
    window_seconds: int = 60
    enabled: bool = True
    created_by: str = "system"
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
