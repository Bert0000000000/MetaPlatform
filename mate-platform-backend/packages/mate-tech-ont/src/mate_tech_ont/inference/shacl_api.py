"""SHACL 校验 API 端点 (v3.2 W2)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .shacl_engine import SHACLEngine, SHACLResult

router = APIRouter(prefix="/api/v1/ont/shacl", tags=["shacl"])

_engine = SHACLEngine()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class ConstraintSpec(BaseModel):
    path: str = Field(..., description="属性路径")
    min_count: int | None = None
    max_count: int | None = None
    datatype: str | None = Field(
        None, description="string | integer | number | boolean"
    )
    pattern: str | None = Field(None, description="正则全匹配")
    min_length: int | None = None
    max_length: int | None = None


class ShapeSpec(BaseModel):
    shape_id: str
    target_class: str
    constraints: list[ConstraintSpec] = Field(default_factory=list)


class ShaclValidateRequest(BaseModel):
    instances: list[dict[str, Any]] = Field(default_factory=list)
    shapes: list[ShapeSpec] = Field(default_factory=list)


class ViolationResponse(BaseModel):
    shape_id: str
    focus_node: str
    path: str
    value: Any = None
    message: str = ""
    severity: str = "Violation"


class ShaclValidateResponse(BaseModel):
    conforms: bool
    violations: list[ViolationResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


def _to_response(result: SHACLResult) -> ShaclValidateResponse:
    return ShaclValidateResponse(
        conforms=result.conforms,
        violations=[
            ViolationResponse(
                shape_id=v.shape_id,
                focus_node=v.focus_node,
                path=v.path,
                value=v.value,
                message=v.message,
                severity=v.severity,
            )
            for v in result.violations
        ],
    )


@router.post("/validate", response_model=ShaclValidateResponse)
async def validate_instances(
    payload: ShaclValidateRequest,
) -> ShaclValidateResponse:
    """对给定 instances 应用 SHACL shapes 校验,返回校验结果。

    无状态端点:instances 与 shapes 均在请求体内提供,
    不依赖 InstanceStore。
    """
    shapes_raw = [
        {
            "shape_id": s.shape_id,
            "target_class": s.target_class,
            "constraints": [c.model_dump(exclude_none=True) for c in s.constraints],
        }
        for s in payload.shapes
    ]
    result = _engine.validate(payload.instances, shapes_raw)
    return _to_response(result)
