"""DBT schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class MaterializationType(str, Enum):
    VIEW = "view"
    TABLE = "table"
    INCREMENTAL = "incremental"
    EPHEMERAL = "ephemeral"


class CreateDbtProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    projectPath: str
    profile: Optional[str] = None
    target: Optional[str] = None


class UpdateDbtProjectRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    projectPath: Optional[str] = None
    profile: Optional[str] = None
    target: Optional[str] = None


class DbtProject(BaseModel):
    id: str
    tenantId: str
    name: str
    projectPath: str
    profile: Optional[str] = None
    target: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class CreateDbtModelRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    schema: Optional[str] = None
    materialized: MaterializationType = MaterializationType.VIEW
    sql: str = ""
    dependencies: List[str] = Field(default_factory=list)


class DbtModel(BaseModel):
    id: str
    projectId: str
    tenantId: str
    name: str
    schema: Optional[str] = None
    materialized: MaterializationType
    sql: str
    dependencies: List[str] = Field(default_factory=list)
    createdAt: datetime


class DbtCompileResult(BaseModel):
    projectId: str
    modelId: Optional[str] = None
    compiledSql: str
    warnings: List[str] = Field(default_factory=list)


class DbtRunResult(BaseModel):
    projectId: str
    status: str
    affectedRows: int = 0
    durationMs: int = 0
    log: List[str] = Field(default_factory=list)


class DbtDagNode(BaseModel):
    id: str
    label: str
    schema: Optional[str] = None
    materialized: MaterializationType


class DbtDagEdge(BaseModel):
    source: str
    target: str


class DbtDag(BaseModel):
    projectId: str
    nodes: List[DbtDagNode] = Field(default_factory=list)
    edges: List[DbtDagEdge] = Field(default_factory=list)