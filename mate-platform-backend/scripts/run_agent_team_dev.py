"""本地跑 agent-team 服务（尚未进 compose 时的联调用）。

用法::

    cd mate-platform-backend
    export SERVICE_CLIENT_SECRET=<...>
    PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe scripts/run_agent_team_dev.py

默认监听 8013。需要 Postgres（RLS 检查点）、llmgw、本体、网关可达。
"""

from __future__ import annotations

import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).parents[1]
for pkg in (
    "mate-tech-agent-team",
    "mate-clients",
    "mate-platform",
    "mate-tech-db",
    "mate-kernel",
    "mate-common",
):
    sys.path.insert(0, str(ROOT / "packages" / pkg / "src"))

os.environ.setdefault(
    "MATE_AGENT_TEAM_ADMIN_DSN", "postgresql://meta:meta@127.0.0.1:5432/metaplatform"
)
os.environ.setdefault(
    "MATE_AGENT_TEAM_DSN", "postgresql://mate_app:mate_app@127.0.0.1:5432/metaplatform"
)
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8180")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("MATE_LLMGW_URL", "http://localhost:8008")
os.environ.setdefault("MATE_ONT_URL", "http://localhost:8007")
os.environ.setdefault("MATE_MCP_URL", "http://localhost:8081")
os.environ.setdefault("MATE_GATEWAY_URL", "http://localhost:8100")

if sys.platform == "win32":
    import asyncio

    # Windows 的 ProactorEventLoop 不支持 psycopg 的 async 连接
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8013"))
    uvicorn.run("mate_tech_agent_team.main:app", host="127.0.0.1", port=port, log_level="info")
