"""Aggregate v1 router for TECH-DATA."""

from fastapi import APIRouter

from app.api.v1 import datasources, schema

router = APIRouter(prefix="/api/v1/data")
router.include_router(datasources.router)
router.include_router(schema.router)
