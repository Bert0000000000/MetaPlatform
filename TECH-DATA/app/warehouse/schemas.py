"""Warehouse schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class WarehouseLayer(str, Enum):
    ODS = "ods"
    DWD = "dwd"
    DWS = "dws"
    ADS = "ads"


class QueryRequest(BaseModel):
    sql: str = Field(min_length=1)
    layer: Optional[WarehouseLayer] = None
    limit: int = Field(default=100, ge=1, le=10000)


class QueryColumn(BaseModel):
    name: str
    type: str


class QueryResult(BaseModel):
    columns: List[QueryColumn]
    rows: List[List[Any]]
    rowCount: int
    durationMs: int


class WarehouseTable(BaseModel):
    name: str
    layer: WarehouseLayer
    schema: str
    rowCount: Optional[int] = None
    lastUpdated: Optional[datetime] = None


class LayerInfo(BaseModel):
    layer: WarehouseLayer
    tableCount: int
    description: str


class MaterializedView(BaseModel):
    id: str
    name: str
    layer: WarehouseLayer
    definition: str
    refreshStrategy: str
    lastRefreshedAt: Optional[datetime] = None
    createdAt: datetime


class CreateMaterializedViewRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    layer: WarehouseLayer
    definition: str
    refreshStrategy: str = "daily"