"""Aggregate v1 router for TECH-ONT discovery service."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import ontology_discovery

router = APIRouter(prefix="/api/v1/ont")
router.include_router(ontology_discovery.router, prefix="/discovery")
