"""DTO 基类（Pydantic v2 严格模式）

所有 DTO 必须继承 BaseDTO，自动获得：
- frozen=True: 不可变
- extra="forbid": 禁止额外字段
- populate_by_name=True: 支持别名
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class BaseDTO(BaseModel):
    """DTO 基类（严格模式）"""

    model_config = ConfigDict(
        strict=True,
        frozen=True,
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
    )


class TimestampMixin(BaseModel):
    """时间戳混入"""

    model_config = ConfigDict(strict=True, frozen=True)

    created_at: Annotated[datetime, Field(description="创建时间")]
    updated_at: Annotated[datetime, Field(description="更新时间")]

    @staticmethod
    def now_utc() -> datetime:
        return datetime.now(UTC)


class TenantMixin(BaseModel):
    """多租户混入"""

    model_config = ConfigDict(strict=True, frozen=True)

    tenant_id: Annotated[str, Field(min_length=1, max_length=64, description="租户 ID")]
