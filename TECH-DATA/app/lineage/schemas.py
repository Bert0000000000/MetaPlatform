"""Lineage schemas (V11-02).

与前端 APP-ONTSTUDIO/src/types/index.ts 中的 DataLineage / LineageNode /
LineageEdge / LineageImpactResult 类型对齐。
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class LineageNodeType(str, Enum):
    DATASOURCE = "datasource"
    TABLE = "table"
    FIELD = "field"
    MAPPING = "mapping"
    CONCEPT = "concept"
    ATTRIBUTE = "attribute"
    ENTITY = "entity"
    RELATION = "relation"
    ACTION = "action"
    OUTPUT = "output"


class LineageEdgeKind(str, Enum):
    FLOW = "flow"
    MAPPING = "mapping"
    REFERENCE = "reference"
    TRIGGER = "trigger"


class LineageNodeMetadata(BaseModel):
    sourceType: Optional[str] = None
    conceptId: Optional[str] = None
    attributeName: Optional[str] = None
    transform: Optional[str] = None
    schedule: Optional[str] = None
    status: Optional[str] = None


class LineageNode(BaseModel):
    id: str
    label: str
    type: LineageNodeType
    parentId: Optional[str] = None
    metadata: Optional[LineageNodeMetadata] = None


class LineageEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    kind: LineageEdgeKind = LineageEdgeKind.FLOW


class DataLineage(BaseModel):
    nodes: List[LineageNode] = Field(default_factory=list)
    edges: List[LineageEdge] = Field(default_factory=list)
    rootId: Optional[str] = None


class ImpactAnalysisRequest(BaseModel):
    nodeId: str


class LineageImpactResult(BaseModel):
    impactedNodes: List[str] = Field(default_factory=list)
    upstreamCount: int = 0
    downstreamCount: int = 0
    impactPath: List[str] = Field(default_factory=list)
