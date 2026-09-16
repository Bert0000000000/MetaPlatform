"""生产装配：把大脑接上真实的 llmgw / MCP 中心 / SkillHub / PG 检查点。

**刻意没有静默回落**（硬规则 #5 的同一精神）：缺 ``MATE_AGENT_TEAM_DSN``
时**直接启动失败**，而不是悄悄退回内存检查点器——那会让"租户隔离由数据库强制"
变成一句空话，而且只在多实例部署时才暴露。
"""

from __future__ import annotations

import os
from typing import Any

from mate_clients.llmgw import LlmgwClient
from mate_clients.mcp.tools import McpToolsClient
from mate_clients.security import BearerAuth
from mate_platform.marketplace.skillhub.store import SkillHubStore

from .brain import BrainService
from .checkpoint import PgCheckpointerProvider, bootstrap
from .employee import LlmEmployeeRuntime
from .llm_planner import LlmPlanner
from .profiles import ProfileRegistry, builtin_profiles
from .skills import SkillCatalog
from .toolbox import McpToolbox

DEFAULT_LLMGW_URL = "http://localhost:8008"
DEFAULT_MCP_URL = "http://localhost:8081"


def _bearer() -> BearerAuth:
    token_uri = (
        f"{os.getenv('KEYCLOAK_URL', 'http://localhost:8080')}"
        "/realms/metaplatform/protocol/openid-connect/token"
    )
    # scope 说明：本 realm 的服务 client 只接受默认/openid（自定义 scope 未注册）。
    return BearerAuth(
        token_uri=token_uri,
        client_id=os.getenv("SERVICE_CLIENT_ID", "metaplatform-backend"),
        client_secret=os.environ["SERVICE_CLIENT_SECRET"],
        scope=os.getenv("SERVICE_CLIENT_SCOPE", "openid"),
    )


def required_dsn() -> str:
    dsn = os.getenv("MATE_AGENT_TEAM_DSN", "")
    if not dsn:
        raise RuntimeError(
            "MATE_AGENT_TEAM_DSN 未配置：本服务要求 langgraph 检查点落在 Postgres"
            "（租户隔离靠 RLS 强制），不提供内存回落。"
        )
    return dsn


def required_admin_dsn() -> str:
    """建表角色必须显式给。

    用服务自己的 DSN 建表会让该角色成为**表 owner**，而 PG 的表 owner
    默认绕过 RLS —— 隔离会**静默失效**（不报错、只是看不见墙）。所以这里
    不给默认值，缺了就启动失败。
    """
    dsn = os.getenv("MATE_AGENT_TEAM_ADMIN_DSN", "")
    if not dsn:
        raise RuntimeError(
            "MATE_AGENT_TEAM_ADMIN_DSN 未配置：建 langgraph 表必须用非服务角色，"
            "否则该角色成为表 owner 会绕过 RLS，租户隔离静默失效。"
        )
    return dsn


def build_service() -> BrainService:
    """按环境变量装配。容器启动时调用一次。"""
    registry = ProfileRegistry(builtin_profiles())
    bearer = _bearer()
    llmgw_url = os.getenv("MATE_LLMGW_URL", DEFAULT_LLMGW_URL)
    mcp_url = os.getenv("MATE_MCP_URL", DEFAULT_MCP_URL)

    def llm_factory(tenant_id: str) -> LlmgwClient:
        return LlmgwClient(llmgw_url, auth=bearer, tenant_id=tenant_id)

    def toolbox_factory(tenant_id: str) -> McpToolbox:
        client: Any = McpToolsClient(mcp_url, auth=bearer, tenant_id=tenant_id)
        return McpToolbox(client)

    bootstrap(required_admin_dsn())

    skills = SkillCatalog(SkillHubStore())
    planner = LlmPlanner(llm_factory=llm_factory, roster=registry.list())
    runtime = LlmEmployeeRuntime(
        registry=registry,
        llm_factory=llm_factory,
        toolbox_factory=toolbox_factory,
        skills=skills,
    )
    return BrainService(
        planner=planner,
        runtime=runtime,
        checkpointer=PgCheckpointerProvider(required_dsn()),
        max_parallel=int(os.getenv("MATE_AGENT_TEAM_MAX_PARALLEL", "3")),
    )


__all__ = ["build_service", "required_admin_dsn", "required_dsn"]
