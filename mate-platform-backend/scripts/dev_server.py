"""Unified dev server — mounts all app routers on a single FastAPI instance.

Usage:
    cd mate-platform-backend
    set INSECURE_SKIP_SIGNATURE=1
    set KEYCLOAK_URL=http://localhost:8080
    set SERVICE_CLIENT_SECRET=test-secret
    python scripts/dev_server.py [--port 8100]

All /api/v1/* routes from 6 app packages are served on one port.
"""
from __future__ import annotations

import argparse
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("dev_server")

# Ensure all packages are importable
_base = r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend\packages"
for pkg in [
    "mate-platform/src",
    "mate-clients/src",
    "mate-kernel/src",
    "mate-common/src",
    "mate-tech-db/src",
    "mate-tech-iam/src",
    "mate-app-hub/src",
    "mate-app-arch/src",
    "mate-app-copilot/src",
    "mate-app-a2a/src",
]:
    _p = _base + "\\" + pkg
    if _p not in sys.path:
        sys.path.insert(0, _p)

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402


def build_app() -> FastAPI:
    app = FastAPI(title="MetaPlatform Dev Server", version="3.2.1")

    # Health check
    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    # IAM dashboard + admin
    try:
        from mate_platform.auth import install_auth

        install_auth(app, extra_anonymous_paths={
            "/api/v1/iam/auth/login",
            "/api/v1/iam/auth/refresh",
            "/api/v1/iam/sso-providers",
            "/api/v1/dashboard/auth/login",
        })
        logger.info("Auth middleware installed (with login anonymous paths)")
    except Exception as e:
        logger.warning("Auth install failed: %s", e)

    # Mount routers
    routers = [
        ("copilot", "mate_app_copilot.api", "router"),
        ("a2a", "mate_app_a2a.api", "router"),
        ("arch", "mate_app_arch.api", "router"),
        ("apphub", "mate_app_hub.api", "router"),
    ]

    for name, module_path, attr in routers:
        try:
            mod = __import__(module_path, fromlist=[attr])
            router = getattr(mod, attr)
            app.include_router(router)
            logger.info("Mounted %s router (%d routes)", name, len(router.routes))
        except Exception as e:
            logger.warning("Failed to mount %s: %s", name, e)

    # IAM routers
    try:
        from mate_tech_iam.api import (
            auth as auth_api,
            dashboard as dashboard_api,
        )
        app.include_router(auth_api.router)
        app.include_router(dashboard_api.router)
        logger.info("Mounted IAM auth + dashboard routers")

        # Initialize IAM database + seed data on startup
        @app.on_event("startup")
        async def _init_iam() -> None:
            try:
                from mate_tech_iam.db import init_db
                await init_db()
                logger.info("IAM database initialized")

                from mate_tech_iam.db import AsyncSessionMaker
                from mate_tech_iam.seed import seed
                async with AsyncSessionMaker() as session:
                    await seed(session)
                    await session.commit()
                logger.info("IAM seed data loaded")
            except Exception as e:
                logger.warning("IAM init/seed failed: %s", e)
    except Exception as e:
        logger.warning("Failed to mount IAM: %s", e)

    # === SuperAI mock endpoints (ontology + agent run) ===
    import uuid as _uuid
    from fastapi import Body as _Body

    _envelopes: dict[str, dict] = {}
    _runs: dict[str, list] = {}

    @app.post("/api/v1/ontology/context/build")
    async def _build_context(payload: dict = _Body(default={})) -> Any:
        envelope_id = f"env-{_uuid.uuid4().hex[:12]}"
        _envelopes[envelope_id] = {
            "envelopeId": envelope_id,
            "signature": {"alg": "HS256", "kid": "dev-key", "value": "dev-sig"},
            "expiresAt": "2026-12-31T23:59:59Z",
        }
        return {"code": 0, "data": _envelopes[envelope_id], "message": "ok"}

    @app.post("/api/v1/agent/runs")
    async def _create_run(payload: dict = _Body(default={})) -> Any:
        run_id = f"run-{_uuid.uuid4().hex[:12]}"
        goal = payload.get("goal", "未指定问题")
        claim1 = {
            "claimId": f"claim-{_uuid.uuid4().hex[:8]}",
            "type": "INFERENCE",
            "content": f"关于「{goal}」的分析结果：华东区销售环比下降 12%，主要受市场需求收缩和竞品促销影响。",
            "confidence": 0.92,
            "evidenceRefs": ["数据源: 内部知识库", "推理链: 3 步"],
        }
        claim2 = {
            "claimId": f"claim-{_uuid.uuid4().hex[:8]}",
            "type": "RECOMMENDATION",
            "content": "建议加大华东区营销投入，优化定价策略，预计可恢复 8% 的销售增长。",
            "confidence": 0.78,
            "evidenceRefs": ["历史数据模型", "竞品分析报告"],
        }
        _runs[run_id] = [
            {"eventId": f"evt-{_uuid.uuid4().hex[:8]}", "runId": run_id,
             "type": "RUN_STARTED", "seq": 1, "ts": "2026-07-31T12:00:00Z",
             "traceId": "", "tenantId": "", "payload": {}, "data": {}},
            {"eventId": f"evt-{_uuid.uuid4().hex[:8]}", "runId": run_id,
             "type": "CLAIM_PRODUCED", "seq": 2, "ts": "2026-07-31T12:00:01Z",
             "traceId": "", "tenantId": "", "payload": {"claim": claim1}, "data": claim1},
            {"eventId": f"evt-{_uuid.uuid4().hex[:8]}", "runId": run_id,
             "type": "CLAIM_PRODUCED", "seq": 3, "ts": "2026-07-31T12:00:02Z",
             "traceId": "", "tenantId": "", "payload": {"claim": claim2}, "data": claim2},
            {"eventId": f"evt-{_uuid.uuid4().hex[:8]}", "runId": run_id,
             "type": "RUN_COMPLETED", "seq": 4, "ts": "2026-07-31T12:00:03Z",
             "traceId": "", "tenantId": "", "payload": {"summary": "分析完成"}, "data": {"summary": "分析完成"}},
        ]
        logger.info("Created agent run %s for goal: %s", run_id, goal[:50])
        return {"code": 0, "data": {"runId": run_id, "status": "RUNNING", "traceId": ""}, "message": "ok"}

    @app.get("/api/v1/agent/runs/{run_id}/events")
    async def _get_events(run_id: str, afterSeq: int = 0) -> Any:
        events = _runs.get(run_id, [])
        result = [e for e in events if e["seq"] > afterSeq]
        return {"code": 0, "data": result, "message": "ok"}

    @app.post("/api/v1/agent/runs/{run_id}/cancel")
    async def _cancel_run(run_id: str) -> Any:
        return {"code": 0, "data": None, "message": "cancelled"}

    logger.info("SuperAI mock endpoints (ontology/context + agent/runs) mounted")

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    app = build_app()
    logger.info("Starting dev server on %s:%d", args.host, args.port)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
