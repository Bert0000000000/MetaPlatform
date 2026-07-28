"""实例管理 API (ST-5.4.7)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from .store import Instance, Relation, store

router = APIRouter(prefix="/api/v1/ont/instances", tags=["instances"])


class InstanceCreate(BaseModel):
    class_id: str
    properties: dict[str, Any] = Field(default_factory=dict)
    namespace: str = "default"


class InstanceResponse(BaseModel):
    id: str
    class_id: str
    properties: dict[str, Any]
    namespace: str


class RelationCreate(BaseModel):
    type: str
    src_id: str
    dst_id: str
    properties: dict[str, Any] = Field(default_factory=dict)


class RelationResponse(BaseModel):
    id: str
    type: str
    src_id: str
    dst_id: str
    properties: dict[str, Any]


@router.post("", response_model=InstanceResponse)
async def create_instance_endpoint(payload: InstanceCreate) -> InstanceResponse:
    inst = store.create_instance(payload.class_id, payload.properties, payload.namespace)
    return InstanceResponse(**inst.__dict__)


@router.get("/{iid}", response_model=InstanceResponse)
async def get_instance_endpoint(iid: str) -> InstanceResponse:
    inst = store.get_instance(iid)
    if inst is None:
        raise HTTPException(status_code=404, detail="not found")
    return InstanceResponse(**inst.__dict__)


@router.get("", response_model=list[InstanceResponse])
async def list_instances_endpoint(class_id: str | None = None) -> list[InstanceResponse]:
    items = store.list_instances(class_id)
    return [InstanceResponse(**i.__dict__) for i in items]


@router.delete("/{iid}")
async def delete_instance_endpoint(iid: str) -> dict[str, bool]:
    return {"deleted": store.delete_instance(iid)}


@router.post("/relations", response_model=RelationResponse)
async def create_relation_endpoint(payload: RelationCreate) -> RelationResponse:
    try:
        rel = store.create_relation(
            payload.type, payload.src_id, payload.dst_id, payload.properties
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RelationResponse(**rel.__dict__)


@router.get("/relations", response_model=list[RelationResponse])
async def list_relations_endpoint() -> list[RelationResponse]:
    return [RelationResponse(**r.__dict__) for r in store.list_relations()]