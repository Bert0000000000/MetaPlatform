"""实例管理 API (ST-5.4.7).

GOVERN-03 (2026-08-07): v1 router — Sunset window (2026-12-31). All
store calls must pass ``request.state.ctx``; the global tenant guard
in ``main._enforce_tenant_per_request`` guarantees a ctx is present
before reaching these handlers.
"""
from __future__ import annotations

import dataclasses
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .store import TenantAccessError, store

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


def _ctx(request: Request):
    ctx = getattr(request.state, "ctx", None)
    if ctx is None or not getattr(ctx, "tenant_id", None):
        raise HTTPException(status_code=401, detail="missing tenant context")
    return ctx


@router.post("", response_model=InstanceResponse)
async def create_instance_endpoint(
    payload: InstanceCreate, request: Request
) -> InstanceResponse:
    inst = store.create_instance(
        _ctx(request), payload.class_id, payload.properties, payload.namespace
    )
    return InstanceResponse(**dataclasses.asdict(inst))


@router.get("", response_model=list[InstanceResponse])
async def list_instances_endpoint(
    request: Request, class_id: str | None = None
) -> list[InstanceResponse]:
    items = store.list_instances(_ctx(request), class_id)
    return [InstanceResponse(**dataclasses.asdict(i)) for i in items]


@router.post("/relations", response_model=RelationResponse)
async def create_relation_endpoint(
    payload: RelationCreate, request: Request
) -> RelationResponse:
    try:
        rel = store.create_relation(
            _ctx(request), payload.type, payload.src_id, payload.dst_id, payload.properties
        )
    except TenantAccessError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    return RelationResponse(**dataclasses.asdict(rel))


@router.get("/relations", response_model=list[RelationResponse])
async def list_relations_endpoint(request: Request) -> list[RelationResponse]:
    return [
        RelationResponse(**dataclasses.asdict(r))
        for r in store.list_relations(_ctx(request))
    ]


# Static-path routes registered before wildcard routes so the
# GET /api/v1/ont/instances/relations path is not shadowed by
# GET /{iid} (which would match iid="relations" and return 404
# because no instance with id "relations" exists).
@router.get("/{iid}", response_model=InstanceResponse)
async def get_instance_endpoint(iid: str, request: Request) -> InstanceResponse:
    inst = store.get_instance(_ctx(request), iid)
    if inst is None:
        raise HTTPException(status_code=404, detail="not found")
    return InstanceResponse(**dataclasses.asdict(inst))


@router.delete("/{iid}")
async def delete_instance_endpoint(iid: str, request: Request) -> dict[str, bool]:
    return {"deleted": store.delete_instance(_ctx(request), iid)}
