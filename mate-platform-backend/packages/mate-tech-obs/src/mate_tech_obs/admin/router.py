"""Operations monitoring endpoints (FR-DASH-006-06).

Designed for the admin dashboard tab. Aggregates:
- Local service health (via health.aggregator)
- Self /metrics snapshot
- Optional Prometheus query passthrough (best-effort)
- Alert rule list (from alerts.rules)

Prometheus integration degrades gracefully when PROM_URL is not configured.
"""
from __future__ import annotations

import os
import time
from typing import Any

import httpx
import structlog
from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..alerts.rules import ALERT_RULES, get_alert_count
from ..health.aggregator import aggregate_health

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/admin/operations", tags=["admin-operations"])

PROM_URL = os.getenv("PROM_URL", "")
HTTP_TIMEOUT_SEC = float(os.getenv("OBS_HTTP_TIMEOUT", "2.0"))


class PrometheusQueryResult(BaseModel):
    query: str
    status: str
    result_type: str | None = None
    value: Any = None
    error: str | None = None


@router.get("/health")
async def operations_health():
    report = await aggregate_health()
    return {
        "code": 0,
        "message": "success",
        "data": {
            "report": report.to_dict(),
            "checkedAt": int(time.time()),
        },
    }


@router.get("/metrics/self")
async def self_metrics():
    from ..metrics.prom import render_metrics

    body, _ = render_metrics()
    text = body.decode("utf-8") if isinstance(body, (bytes, bytearray)) else str(body)

    def _parse_value(name):
        for line in text.splitlines():
            if line.startswith(name + " ") or line.startswith(name + "{"):
                parts = line.rsplit(" ", 1)
                try:
                    return float(parts[-1])
                except ValueError:
                    continue
        return None

    snapshot = {
        "processCpuSecondsTotal": _parse_value("process_cpu_seconds_total"),
        "processResidentMemoryBytes": _parse_value("process_resident_memory_bytes"),
        "pythonGcObjectsCollectedTotal": _parse_value("python_gc_objects_collected_total"),
        "httpRequestsTotal": _parse_value("http_requests_total"),
        "httpRequestDurationSecondsCount": _parse_value("http_request_duration_seconds_count"),
    }
    return {"code": 0, "message": "success", "data": {"metrics": snapshot, "checkedAt": int(time.time())}}


@router.get("/alerts/rules")
async def list_alert_rules():
    return {
        "code": 0,
        "message": "success",
        "data": {
            "rules": [
                {
                    "alert": r.alert,
                    "severity": r.severity,
                    "for": r.for_duration,
                    "description": r.description,
                    "summary": r.annotations.get("summary"),
                }
                for r in ALERT_RULES
            ],
            "total": get_alert_count(),
        },
    }


@router.get("/prometheus/query")
async def prometheus_query(query: str = Query(..., description="PromQL expression")):
    if not PROM_URL:
        return {
            "code": 0,
            "message": "success",
            "data": {"query": query, "status": "unavailable", "error": "PROM_URL not configured"},
        }
    base = PROM_URL.rstrip("/")
    url = base + "/api/v1/query"
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SEC) as client:
            resp = await client.get(url, params={"query": query})
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("prometheus.query_failed", error=str(exc))
        return {
            "code": 0,
            "message": "success",
            "data": {"query": query, "status": "unavailable", "error": str(exc)},
        }
    result = data.get("data", {}) if isinstance(data, dict) else {}
    return {
        "code": 0,
        "message": "success",
        "data": {
            "query": query,
            "status": result.get("resultType", "unknown"),
            "result_type": result.get("resultType"),
            "value": result.get("result"),
        },
    }


@router.get("/capacity")
async def capacity_snapshot():
    report = await aggregate_health()
    summary = report.summary
    return {
        "code": 0,
        "message": "success",
        "data": {
            "services": summary,
            "alerts": {"total": get_alert_count(), "configured": True},
            "prometheus": {"configured": bool(PROM_URL)},
            "checkedAt": int(time.time()),
        },
    }

