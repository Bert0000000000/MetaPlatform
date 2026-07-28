"""Ontology API (ST-5.4.3).

本体 + 类 CRUD 端点。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/ont", tags=["ontology"])


class OntologyCreate(BaseModel):
    id: str
    namespace: str = "default"
    description: str = ""


class Ontology(BaseModel):
    id: str
    namespace: str
    description: str


class ClassCreate(BaseModel):
    id: str
    namespace: str = "default"
    label: str = ""
    parent: str | None = None
    properties: list[dict[str, Any]] = []


class ClassResponse(BaseModel):
    id: str
    namespace: str
    label: str
    parent: str | None = None
    properties: list[dict[str, Any]] = []


_ontologies: dict[str, Ontology] = {}
_classes: dict[str, ClassResponse] = {}


@router.post("/ontologies", response_model=Ontology)
async def create_ontology(payload: OntologyCreate) -> Ontology:
    if payload.id in _ontologies:
        raise HTTPException(status_code=409, detail=f"Ontology '{payload.id}' exists")
    o = Ontology(**payload.model_dump())
    _ontologies[payload.id] = o
    return o


@router.get("/ontologies/{ontology_id}", response_model=Ontology)
async def get_ontology(ontology_id: str) -> Ontology:
    o = _ontologies.get(ontology_id)
    if o is None:
        raise HTTPException(status_code=404, detail="not found")
    return o


@router.post("/classes", response_model=ClassResponse)
async def create_class(payload: ClassCreate) -> ClassResponse:
    if payload.id in _classes:
        raise HTTPException(status_code=409, detail=f"Class '{payload.id}' exists")
    c = ClassResponse(**payload.model_dump())
    _classes[payload.id] = c
    return c


@router.get("/classes/{class_id}", response_model=ClassResponse)
async def get_class(class_id: str) -> ClassResponse:
    c = _classes.get(class_id)
    if c is None:
        raise HTTPException(status_code=404, detail="not found")
    return c