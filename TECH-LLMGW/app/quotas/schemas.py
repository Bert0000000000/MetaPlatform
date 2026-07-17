"""Pydantic schemas for the Quota domain."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class QuotaScope(str, Enum):
    TENANT = "TENANT"
    USER = "USER"
    APP = "APP"
    MODEL = "MODEL"


class QuotaType(str, Enum):
    REQUEST_DAILY = "REQUEST_DAILY"
    TOKEN_DAILY = "TOKEN_DAILY"
    TOKEN_MONTHLY = "TOKEN_MONTHLY"


class QuotaStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class QuotaCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    scope: QuotaScope
    targetId: str = Field(..., min_length=1)
    type: QuotaType
    limitValue: int = Field(..., ge=1)
    alertThreshold: int = Field(default=80, ge=50, le=99)
    enabled: bool = Field(default=True)
    resetWindow: Optional[str] = Field(default=None)


class QuotaUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    limitValue: Optional[int] = Field(default=None, ge=1)
    usedValue: Optional[int] = Field(default=None, ge=0)
    alertThreshold: Optional[int] = Field(default=None, ge=50, le=99)
    enabled: Optional[bool] = Field(default=None)
    resetWindow: Optional[str] = Field(default=None)


class QuotaRecord(BaseModel):
    """Internal persisted quota record."""

    quota_id: str
    tenant_id: str
    name: str
    scope: QuotaScope
    target_id: str
    type: QuotaType
    limit_value: int
    used_value: int = 0
    alert_threshold: int = 80
    enabled: bool = True
    reset_window: Optional[str] = None
    created_by: str = "system"
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
