"""Custom dashboard configuration write endpoints.

Endpoints (under ``/api/v1/admin/operations/dashboard-configs``):

  POST /api/v1/admin/operations/dashboard-configs             — create config
  GET  /api/v1/admin/operations/dashboard-configs             — list configs
  PUT  /api/v1/admin/operations/dashboard-configs/{config_id} — update config

ADR-0014 5-step pattern:
  1. install_auth — wired in main.py.
  2. require_tenant — every handler reads ``request.state.ctx``.
  3. Outbox — (future) emit ``obs.dashboard_config.created / updated``.
  4. BearerAuth — install_auth enforces it.
  5. Cross-tenant negative tests — see ``tests/test_dashboard_config.py``.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from mate_platform.tenancy.guards import require_tenant

from .store import DashboardConfig, DashboardConfigStore

router = APIRouter(
    prefix="/api/v1/admin/operations/dashboard-configs",
    tags=["obs-dashboard-configs"],
)

# Module-level store (main.py overrides with its own instance at
# app-import time; tests can also set this directly).
dashboard_config_store: DashboardConfigStore = DashboardConfigStore()


def _set_store(store: DashboardConfigStore) -> None:
    """Called by main.py to share its store instance with the router."""
    global dashboard_config_store  # noqa: PLW0603
    dashboard_config_store = store


def _tenant_id(request: Request) -> str:
    ctx = request.state.ctx
    return str(require_tenant(ctx))


def _serialize(config: DashboardConfig) -> dict[str, Any]:
    d = asdict(config)
    d["created_at"] = config.created_at.isoformat()
    return d


@router.post("", status_code=201)
async def create_dashboard_config(request: Request) -> dict[str, Any]:
    """Create a custom dashboard configuration for the calling tenant."""
    tenant_id = _tenant_id(request)
    body = await request.json()
    name = body.get("name")
    config = body.get("config", {})
    if not name or not isinstance(name, str):
        raise HTTPException(status_code=400, detail="name is required")
    if not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="config must be an object")
    try:
        entry = dashboard_config_store.create_dashboard_config(
            tenant_id=tenant_id,
            name=name,
            config=config,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"config": _serialize(entry)}


@router.get("")
async def list_dashboard_configs(request: Request) -> dict[str, Any]:
    """List all dashboard configurations for the calling tenant."""
    tenant_id = _tenant_id(request)
    configs = dashboard_config_store.get_dashboard_configs(tenant_id=tenant_id)
    return {
        "items": [_serialize(c) for c in configs],
        "total": len(configs),
    }


@router.put("/{config_id}")
async def update_dashboard_config(
    config_id: str, request: Request
) -> dict[str, Any]:
    """Update an existing custom dashboard configuration."""
    tenant_id = _tenant_id(request)
    body = await request.json()
    name = body.get("name")
    config = body.get("config")
    if name is not None and not isinstance(name, str):
        raise HTTPException(status_code=400, detail="name must be a string")
    if config is not None and not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="config must be an object")
    try:
        entry = dashboard_config_store.update_dashboard_config(
            tenant_id=tenant_id,
            config_id=config_id,
            name=name,
            config=config,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="dashboard config not found") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"config": _serialize(entry)}


__all__ = ["router", "dashboard_config_store", "_set_store"]
