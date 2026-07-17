"""ORM-style Pydantic models for DBT projects & models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class DbtProjectORM(BaseModel):
    id: str
    tenant_id: str
    name: str
    project_path: str
    profile: Optional[str] = None
    target: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DbtModelORM(BaseModel):
    id: str
    tenant_id: str
    project_id: str
    name: str
    schema: Optional[str] = None
    materialized: str = "view"
    sql: str = ""
    dependencies: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))