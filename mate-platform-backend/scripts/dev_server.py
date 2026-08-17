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
import asyncio
import logging
import os
import sys

# Windows dev only: psycopg async (the IAM/PG driver) is incompatible with the
# default ProactorEventLoop; force SelectorEventLoop so dev server DB calls
# work. No-op on Linux (prod). Must run before any async DB code.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

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
from typing import Any  # noqa: E402


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
            "/api/v1/llmgw/chat",
            "/api/v1/llmgw/chat/stream",
            "/api/v1/llmgw/embeddings",
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

    # DW router (digital workforce)
    try:
        sys.path.insert(0, _base + r"\mate-tech-dw\src")
        from mate_tech_dw.api import router as dw_router
        app.include_router(dw_router)
        logger.info("Mounted dw router (%d routes)", len(dw_router.routes))
    except Exception as e:
        logger.warning("Failed to mount dw: %s", e)

    # LLM Gateway router (mate-tech-llmgw) — provides /api/v1/llmgw/chat/stream
    try:
        sys.path.insert(0, _base + r"\mate-tech-llmgw\src")
        from mate_tech_llmgw.api.routes import router as llmgw_router
        app.include_router(llmgw_router)
        logger.info("Mounted llmgw router (%d routes)", len(llmgw_router.routes))
    except Exception as e:
        logger.warning("Failed to mount llmgw: %s", e)

    # IAM routers
    try:
        from mate_tech_iam.api import (
            auth as auth_api,
            configs as configs_api,
            dashboard as dashboard_api,
            models as models_api,
        )
        app.include_router(auth_api.router)
        app.include_router(dashboard_api.router)
        app.include_router(configs_api.router)
        app.include_router(models_api.router)
        logger.info("Mounted IAM auth + dashboard + configs + ai-models routers")

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

    # mate-app-kb + mate-tech-rag: these are full FastAPI apps whose routes
    # use absolute /api/v1/* paths, so they can't be mounted under a prefix
    # (the mount would strip the prefix and break the absolute routes). We
    # steal their routes onto the host so the single host auth middleware
    # governs both services on one port — which is what the vite proxy
    # (all /api/v1/* → :8100) and the frontend KB module expect.
    try:
        sys.path.insert(0, _base + r"\mate-app-kb\src")
        sys.path.insert(0, _base + r"\mate-tech-rag\src")
        from mate_app_kb.api.app import create_app as _create_kb_app
        from mate_tech_rag.api.app import create_app as _create_rag_app
        _kb = _create_kb_app()
        _rag = _create_rag_app()
        app.routes.extend(_kb.routes)
        app.routes.extend(_rag.routes)
        # KB/RAG handlers read request.app.state.outbox_writer; give the host one.
        from mate_platform.messaging.outbox import InMemoryOutboxWriter
        if not hasattr(app.state, "outbox_writer"):
            app.state.outbox_writer = InMemoryOutboxWriter()
        logger.info("Mounted kb (%d routes) + rag (%d routes)", len(_kb.routes), len(_rag.routes))
    except Exception as e:
        logger.warning("Failed to mount kb/rag: %s", e)

    # mate-tech-ont (本体引擎) — same route-steal pattern. Provides /api/v1/ont/*
    # endpoints (v1 + v2_kernel router) consumed by the frontend's ontology
    # pages (Modeling/Datacenter/Action/Graph). create_app() factored out of
    # main.py specifically so this dev-server mount doesn't trigger the
    # import-time KEYCLOAK auth + Neo4j connect.
    try:
        sys.path.insert(0, _base + r"\mate-tech-ont\src")
        sys.path.insert(0, _base + r"\mate-kernel\src")
        from mate_tech_ont.main import create_app as _create_ont_app
        _ont = _create_ont_app()
        app.routes.extend(_ont.routes)
        logger.info("Mounted ont (%d routes)", len(_ont.routes))
        # Route-steal copies routes but does NOT propagate startup hooks. The
        # v2_kernel router reads app.state.kernel_repo at request time, so
        # initialise it now — same KERNEL_BACKEND selection as main.py's
        # on_startup (pg → PgOntologyRepository, persistent), optional demo
        # seed (idempotent upserts, safe on every boot).
        _kb_backend = os.environ.get("KERNEL_BACKEND", "memory").lower()
        if _kb_backend == "pg":
            from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

            app.state.kernel_repo = PgOntologyRepository(
                dsn=os.environ.get(
                    "KERNEL_PG_DSN",
                    "postgresql://meta:meta@127.0.0.1:5432/metaplatform",
                )
            )
        else:
            from mate_kernel.ontology.in_memory import InMemoryOntologyRepository

            app.state.kernel_repo = InMemoryOntologyRepository()
        if os.getenv("ONT_SEED_DEMO", "0") == "1":
            from mate_tech_ont.v2_kernel.seed import (
                backfill_action_display,
                seed_demo,
                seed_hr_it_finance_orchestrator,
            )

            seed_demo(app.state.kernel_repo)
            seed_hr_it_finance_orchestrator(app.state.kernel_repo)
            backfill_action_display(app.state.kernel_repo)
        logger.info("kernel_repo.initialized", extra={"backend": _kb_backend})
    except Exception as e:
        logger.warning("Failed to mount ont: %s", e)

    # In-process IAM config reader: the unified dev server runs llmgw + IAM in
    # the same process, so llmgw's embedding resolution reads the shared IAM
    # SystemConfig store directly (no Keycloak service-identity round-trip,
    # which dev has no Keycloak for). Production llmgw (separate service) uses
    # the HTTP + service-identity path in resolve_effective_embedding instead.
    async def _read_iam_configs(tenant_id: str) -> list[dict]:
        from sqlalchemy import select
        from mate_tech_iam.db import AsyncSessionMaker
        from mate_tech_iam.domain.system_config import SystemConfig

        async with AsyncSessionMaker() as session:
            rows = await session.execute(
                select(SystemConfig).where(SystemConfig.tenant_id == tenant_id)
            )
            return [
                {"key": r.key, "value": r.value}
                for r in rows.scalars().all()
            ]

    app.state.iam_config_reader = _read_iam_configs
    logger.info("Injected in-process IAM config reader for llmgw embedding resolution")

    return app


def _make_dev_token() -> str:
    """Mint an HS256 service token for dev cross-service calls.

    The unified dev server has no Keycloak, so service_identity cannot do the
    client_credentials round-trip. This token (signed with SERVICE_CLIENT_SECRET)
    is accepted by the verifier because INSECURE_SKIP_SIGNATURE=1 skips signature
    checks. It carries PLATFORM_SUPER_ADMIN + tenant-default so DW→rag uploads pass
    require_tenant.
    """
    import time as _t

    import jwt as _jwt

    now = int(_t.time())
    secret = os.environ.get("SERVICE_CLIENT_SECRET", "test-secret")
    return _jwt.encode(
        {
            "sub": "admin",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "admin",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "scope": "platform.read platform.write",
            "tenant_id": "tenant-default",
            "attributes": {"tenant_id": ["tenant-default"]},
            "iat": now,
            "exp": now + 86_400,  # 24h — dev server lifetime
        },
        secret,
        algorithm="HS256",
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    # Persistent-storage defaults (真实环境持久化): RAG chunks + embeddings
    # live in PG kb_chunks (RAG_MODE=pg), KB collections/documents live in PG
    # via the SQLAlchemy store (KB_STORE=sql + MATE_DB_URL), DW entities live
    # in PG (DW_STORE=sql), and the ontology kernel repo persists through
    # PgOntologyRepository (KERNEL_BACKEND=pg). setdefault so an explicit env
    # always wins. The shared docker PG is mate-postgres
    # (meta/meta @ 127.0.0.1:5432/metaplatform).
    _PG_SYNC = "postgresql://meta:meta@127.0.0.1:5432/metaplatform"
    _PG_ALCHEMY = "postgresql+psycopg://meta:meta@127.0.0.1:5432/metaplatform"
    os.environ.setdefault("PG_DSN", _PG_SYNC)
    os.environ.setdefault("RAG_MODE", "pg")
    os.environ.setdefault("KB_STORE", "sql")
    os.environ.setdefault("DW_STORE", "sql")
    os.environ.setdefault("MATE_DB_URL", _PG_ALCHEMY)
    os.environ.setdefault("KERNEL_BACKEND", "pg")
    os.environ.setdefault("KERNEL_PG_DSN", _PG_SYNC)

    app = build_app()
    # Dev cross-service loopback: DW (and mate-app-kb) RAGClient call back into
    # this process's rag routes instead of a separate localhost:8001 service.
    os.environ["RAG_URL"] = f"http://localhost:{args.port}"
    app.state.dev_token = _make_dev_token()
    logger.info("Dev RAG_URL=%s + service dev_token set", os.environ["RAG_URL"])
    logger.info("Starting dev server on %s:%d", args.host, args.port)
    if sys.platform == "win32":
        # Run uvicorn on an explicit SelectorEventLoop: psycopg async (the IAM/PG
        # driver) is incompatible with Windows' default ProactorEventLoop. uvicorn.run
        # via asyncio.run() does not honour the policy on some setups, so drive the
        # server manually. No-op behaviour difference on the dev workload.
        config = uvicorn.Config(app, host=args.host, port=args.port, loop="asyncio")
        server = uvicorn.Server(config)
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(server.serve())
    else:
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")
