"""Catalog schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class AssetType(str, Enum):
    TABLE = "TABLE"
    VIEW = "VIEW"
    FILE = "FILE"
    API = "API"
    STREAM = "STREAM"


class ClassificationLevel(str, Enum):
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    CONFIDENTIAL = "CONFIDENTIAL"
    SECRET = "SECRET"


class DataAsset(BaseModel):
    id: str
    tenantId: str
    name: str
    code: str
    assetType: AssetType
    description: Optional[str] = None
    layer: Optional[str] = None
    classification: ClassificationLevel = ClassificationLevel.INTERNAL
    owner: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    createdAt: datetime
    updatedAt: datetime


class AssetMetadata(BaseModel):
    schema: List[dict[str, Any]] = Field(default_factory=list)
    partitions: List[str] = Field(default_factory=list)
    storageLocation: Optional[str] = None
    sizeBytes: Optional[int] = None
    rowCount: Optional[int] = None
    format: Optional[str] = None
    properties: dict[str, Any] = Field(default_factory=dict)


class LineageNode(BaseModel):
    id: str
    name: str
    type: str


class LineageEdge(BaseModel):
    source: str
    target: str
    transformation: Optional[str] = None


class LineageInfo(BaseModel):
    assetId: str
    upstream: List[LineageNode] = Field(default_factory=list)
    downstream: List[LineageNode] = Field(default_factory=list)
    edges: List[LineageEdge] = Field(default_factory=list)


class ColumnProfile(BaseModel):
    name: str
    type: str
    nullCount: int = 0
    distinctCount: int = 0
    sampleValues: List[Any] = Field(default_factory=list)


class ProfileInfo(BaseModel):
    assetId: str
    rowCount: int = 0
    columnCount: int = 0
    profiledAt: datetime
    columns: List[ColumnProfile] = Field(default_factory=list)