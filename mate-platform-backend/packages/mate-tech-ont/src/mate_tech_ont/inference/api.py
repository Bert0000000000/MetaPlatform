"""推理 API 端点 (ST-5.4.9)."""
from __future__ import annotations

import dataclasses
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .engine import (
    InferenceEngine,
    InferenceRule,
    SubclassRule,
    TransitivityRule,
)

router = APIRouter(prefix="/api/v1/ont/inference", tags=["inference"])

_engine = InferenceEngine()


def _tenant_id(request: Request) -> str:
    ctx = getattr(request.state, "ctx", None)
    if ctx is None:
        raise HTTPException(status_code=401, detail="no auth context")
    tid = getattr(ctx, "tenant_id", None)
    if tid is None:
        raise HTTPException(status_code=403, detail="missing tenant")
    return str(tid)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class RuleSpec(BaseModel):
    type: str = Field(..., description="subclass | transitivity")
    rel_type: str = Field("subclass_of", description="关系类型")


class InferenceApplyRequest(BaseModel):
    rules: list[RuleSpec] = Field(default_factory=list)


class InheritedPropertyResponse(BaseModel):
    instance_id: str
    from_class: str
    properties: dict[str, Any] = Field(default_factory=dict)


class InferredRelationResponse(BaseModel):
    src_id: str
    dst_id: str
    type: str
    via: list[str] = Field(default_factory=list)


class InferenceApplyResponse(BaseModel):
    inherited: list[InheritedPropertyResponse] = Field(default_factory=list)
    inferred_relations: list[InferredRelationResponse] = Field(default_factory=list)


class PathResponse(BaseModel):
    source: str
    target: str
    path: list[str] | None = None
    found: bool = False


class NeighborsResponse(BaseModel):
    node: str
    depth: int
    neighbors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


_RULE_MAP: dict[str, type[InferenceRule]] = {
    "subclass": SubclassRule,
    "transitivity": TransitivityRule,
}


@router.post("/apply", response_model=InferenceApplyResponse)
async def apply_inference(
    payload: InferenceApplyRequest,
    request: Request,
) -> InferenceApplyResponse:
    """应用推理规则(subclass 继承 + transitivity 传递闭包)."""
    tid = _tenant_id(request)
    rules: list[InferenceRule] = []
    for spec in payload.rules:
        cls = _RULE_MAP.get(spec.type)
        if cls is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown rule type: {spec.type}",
            )
        rules.append(cls(rel_type=spec.rel_type))

    result = _engine.apply_rules(tid, rules)

    return InferenceApplyResponse(
        inherited=[
            InheritedPropertyResponse(**dataclasses.asdict(ip))
            for ip in result.inherited
        ],
        inferred_relations=[
            InferredRelationResponse(**dataclasses.asdict(ir))
            for ir in result.inferred_relations
        ],
    )


@router.get("/path", response_model=PathResponse)
async def find_path(
    request: Request,
    source: str,
    target: str,
    max_depth: int = 10,
) -> PathResponse:
    """查询最短路径(BFS)."""
    tid = _tenant_id(request)
    path = _engine.find_path(tid, source, target, max_depth)
    return PathResponse(
        source=source,
        target=target,
        path=path,
        found=path is not None,
    )


@router.get("/neighbors", response_model=NeighborsResponse)
async def get_neighbors(
    request: Request,
    node: str,
    depth: int = 1,
) -> NeighborsResponse:
    """K-hop 邻居发现."""
    tid = _tenant_id(request)
    neighbors = _engine.get_neighbors(tid, node, depth)
    return NeighborsResponse(node=node, depth=depth, neighbors=neighbors)
