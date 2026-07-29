"""健康检查聚合 (ST-5.2.9)."""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class HealthStatus:
    name: str
    healthy: bool
    detail: str = ""
    latency_ms: float = 0.0


@dataclass
class HealthReport:
    overall: bool = True
    components: list[HealthStatus] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall": self.overall,
            "summary": self.summary,
            "components": [
                {
                    "name": c.name,
                    "healthy": c.healthy,
                    "detail": c.detail,
                    "latency_ms": c.latency_ms,
                }
                for c in self.components
            ],
        }


DEFAULT_TARGETS: list[tuple[str, str, str]] = [
    ("app", "portal", "http://portal:5173/healthz"),
    ("app", "dashboard", "http://dashboard:5174/healthz"),
    ("app", "ontstudio", "http://ontstudio:5175/healthz"),
    ("app", "kb", "http://kb:5176/healthz"),
    ("app", "mcphub", "http://mcphub:5177/healthz"),
    ("app", "apphub", "http://apphub:5178/healthz"),
    ("app", "arch", "http://arch:5179/healthz"),
    ("app", "dw", "http://dw:5180/healthz"),
    ("app", "superai", "http://superai:5181/healthz"),
    ("infra", "postgres", "postgresql://pg:5432/mate"),
    ("infra", "redis", "redis://redis:6379/0"),
    ("infra", "kafka", "kafka://kafka:9092"),
    ("infra", "neo4j", "bolt://neo4j:7687"),
    ("infra", "milvus", "http://milvus:19530"),
    ("infra", "minio", "http://minio:9000/minio/health/live"),
    ("infra", "keycloak", "http://keycloak:8080/realms/master"),
]


async def check_endpoint(name: str, url: str, timeout: float = 2.0) -> HealthStatus:  # noqa: ASYNC109
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url)
            latency = (time.time() - start) * 1000
            return HealthStatus(
                name=name,
                healthy=resp.status_code < 500,
                detail=f"HTTP {resp.status_code}",
                latency_ms=latency,
            )
    except Exception as e:
        latency = (time.time() - start) * 1000
        return HealthStatus(
            name=name,
            healthy=False,
            detail=f"unreachable: {e}",
            latency_ms=latency,
        )


async def aggregate_health(
    targets: list[tuple[str, str, str]] | None = None,
    timeout: float = 2.0,  # noqa: ASYNC109
) -> HealthReport:
    targets = DEFAULT_TARGETS if targets is None else targets
    tasks = [
        check_endpoint(name, url, timeout)
        for _kind, name, url in targets
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    report = HealthReport()
    for r in results:
        if isinstance(r, BaseException):
            report.components.append(HealthStatus(name="unknown", healthy=False, detail=str(r)))
            continue
        report.components.append(r)
    report.overall = all(c.healthy for c in report.components)
    report.summary = {
        "total": len(report.components),
        "healthy": sum(1 for c in report.components if c.healthy),
        "down": sum(1 for c in report.components if not c.healthy),
    }
    return report
