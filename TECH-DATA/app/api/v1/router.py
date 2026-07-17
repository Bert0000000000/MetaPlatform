"""Aggregate v1 router for TECH-DATA."""

from fastapi import APIRouter

from app.api.v1 import (
    catalog,
    dbt,
    datasources,
    etl,
    lakehouse,
    monitoring,
    quality,
    schema,
    warehouse,
)

router = APIRouter(prefix="/api/v1/data")
router.include_router(datasources.router)
router.include_router(schema.router)
router.include_router(etl.router)
router.include_router(dbt.router)
router.include_router(lakehouse.router)
router.include_router(warehouse.router)
router.include_router(catalog.router)
router.include_router(quality.router)
router.include_router(monitoring.router)
