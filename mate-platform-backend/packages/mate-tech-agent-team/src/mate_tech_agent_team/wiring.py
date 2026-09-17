"""生产装配：把大脑接上真实的 llmgw / MCP 中心 / SkillHub / PG 检查点。

本体不在这里单接：本体工具经 MCP 总线（1.1 task 1c 起 MCP 代理逐请求透传
调用方 token + 租户）。

**刻意没有静默回落**（硬规则 #5 的同一精神）：缺 ``MATE_AGENT_TEAM_DSN``
或 ``MATE_AGENT_TEAM_ADMIN_DSN`` 时**直接启动失败**，而不是悄悄退回内存
检查点器或用服务身份冒名建表——那会让"租户隔离由数据库强制"变成一句空话。
"""

from __future__ import annotations

import os
from typing import Any

from mate_clients.iam import IamServiceReadClient
from mate_clients.llmgw import LlmgwClient
from mate_clients.mcp.tools import McpToolsClient
from mate_clients.security import BearerAuth
from mate_platform.marketplace.skillhub.store import SkillHubStore

from .brain import BrainService, RunContext
from .checkpoint import SCHEMA as CHECKPOINT_SCHEMA
from .checkpoint import PgCheckpointerProvider, bootstrap
from .employee import LlmEmployeeRuntime
from .llm_planner import LlmPlanner
from .profile_store import ProfileStore
from .profiles import ProfileRegistry
from .retry import DEFAULT_BACKOFF_SECONDS, DEFAULT_MAX_ATTEMPTS, RetryPolicy
from .skill_toolbox import SKILL_TOOL_NAMES, SkillToolbox
from .skills import SkillCatalog
from .team_bus import DEFAULT_MAX_DEPTH, TeamBus
from .team_task_store import PgTeamTasks
from .toolbox import CompositeToolbox, McpToolbox

DEFAULT_LLMGW_URL = "http://localhost:8008"
DEFAULT_MCP_URL = "http://localhost:8081"
DEFAULT_GATEWAY_URL = "http://localhost:8100"
#: MCP 中心的标准协议面（streamable-http），1.1 起对外客户端就走这条。
DEFAULT_MCP_PROTOCOL_PATH = "/api/v1/mcp/protocol/mcp"


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


def build_skill_catalog() -> SkillCatalog:
    """技能目录（SkillHub 读取侧）。HTTP 面与员工运行时共用同一个构建方式。"""
    return SkillCatalog(SkillHubStore())


def build_profile_store() -> ProfileStore:
    """员工身份落库面（建/改入口与名册读的是同一张表，1.3 轨 2）。"""
    return ProfileStore(required_dsn(), schema=CHECKPOINT_SCHEMA)


def build_registry(store: ProfileStore | None = None) -> ProfileRegistry:
    """员工名册：内置定义 + 本租户落库的行（1.1 任务 3）。"""
    return ProfileRegistry(store=store or build_profile_store())


def build_team_bus(registry: ProfileRegistry | None = None, *, dsn: str | None = None) -> TeamBus:
    """派活闸门（1.1 任务 4/5）+ 消息通道（1.2 任务 2）。

    深度的默认值对齐 Codex 的 ``agents.max_depth`` 与 Claude Code 的 3 层；
    可用 ``MATE_AGENT_TEAM_MAX_DEPTH`` 覆盖。

    任务实例（含 ``inbox``）落 PG：HTTP 面的 ``send`` 与员工侧的 drain 可能
    不在同一个进程里跑，内存版会让消息投进虚空。
    """
    return TeamBus(
        registry=registry or build_registry(),
        max_depth=int(os.getenv("MATE_AGENT_TEAM_MAX_DEPTH", str(DEFAULT_MAX_DEPTH))),
        tasks=PgTeamTasks(dsn or required_dsn(), schema=CHECKPOINT_SCHEMA),
    )


def build_service(
    *, registry: ProfileRegistry | None = None, team_bus: TeamBus | None = None
) -> BrainService:
    """按环境变量装配。容器启动时调用一次。

    ``team_bus`` 必须与 HTTP 面用的是**同一个实例**——投递方往它的 inbox 写、
    员工从它的 inbox 取，两个实例等于两个信箱。
    """
    registry = registry or build_registry()
    bearer = _bearer()
    llmgw_url = os.getenv("MATE_LLMGW_URL", DEFAULT_LLMGW_URL)
    mcp_url = os.getenv("MATE_MCP_URL", DEFAULT_MCP_URL)
    gateway_url = os.getenv("MATE_GATEWAY_URL", DEFAULT_GATEWAY_URL)
    protocol_url = os.getenv("MATE_MCP_PROTOCOL_URL", f"{mcp_url}{DEFAULT_MCP_PROTOCOL_PATH}")

    bootstrap(required_admin_dsn())
    skills = build_skill_catalog()

    def _provider_config(tenant_id: str, user_token: str):
        """惰性取租户当前生效的上游 provider 配置。

        不带 base_url/api_key 时 llmgw 会走 stub-fallback（把输入回显），那正是
        D-10 要治的"假回执"，所以生产必须喂这两项。

        **认证用发起用户的令牌**：服务身份 token 的 ``iss`` 由换发它的 Keycloak
        地址决定，网关与 llmgw 校验的地址不一致时会被判 401；用户令牌本就是
        网关签发的，两端都认。服务密钥（``X-Service-Secret``）仍是取敏感值的闸门。
        """

        async def _resolve() -> dict[str, str]:
            client = IamServiceReadClient(
                gateway_url,
                service_secret=os.getenv("SERVICE_CLIENT_SECRET", ""),
                token=user_token,
            )
            try:
                return await client.get_provider_config(tenant_id)
            finally:
                await client.aclose()

        return _resolve

    def _llm_for(ctx: RunContext):
        def _make(tenant_id: str) -> LlmgwClient:
            return LlmgwClient(
                llmgw_url,
                auth=bearer,
                tenant_id=tenant_id,
                user_token=ctx.user_token,
                provider_config=_provider_config(tenant_id, ctx.user_token),
            )

        return _make

    def _toolbox(ctx: RunContext) -> CompositeToolbox:
        # 1.1 task 1c: 本体工具不再走旁路 —— MCP 的本体代理已改为逐请求透传
        # 调用方 token + 租户，本体与其它工具共用同一条总线（单一工具面）。
        #
        # 1.2: 派发经**标准 MCP 协议面**（langchain-mcp-adapters 建会话），
        # 但发现/闸门仍在 REST 面 —— 协议面的 tools/list 不带 agentInvokable，
        # 跟着换会让人工闸门工具重新摆到模型面前。
        mcp = McpToolbox(
            McpToolsClient(
                mcp_url, auth=bearer, tenant_id=ctx.tenant_id, user_token=ctx.user_token
            ),
            protocol=_protocol_connection(ctx),
        )
        return CompositeToolbox(
            mcp=mcp,
            skills=SkillToolbox(skills, tenant_id=ctx.tenant_id),
            skill_names=SKILL_TOOL_NAMES,
        )

    def _protocol_connection(ctx: RunContext) -> dict[str, Any] | None:
        """协议面连接配置；没有发起用户令牌时不启用。

        协议面按 token 的 tenant claim 解析租户，服务身份 token 不带该 claim
        （env-facts §3）。没有用户令牌就退回 ACL 客户端，而不是拿服务身份去撞。
        ``X-Tenant-Id`` 刻意不传：协议面要求它与 token 的租户一致，不一致直接
        403——租户由令牌唯一决定，多带一个头只会制造不一致的机会。
        """
        if not ctx.user_token:
            return None
        return {
            "transport": "streamable_http",
            "url": protocol_url,
            "headers": {"Authorization": f"Bearer {ctx.user_token}"},
        }

    def planner_for(ctx: RunContext) -> LlmPlanner:
        return LlmPlanner(
            llm_factory=_llm_for(ctx),
            roster=[],
            roster_provider=lambda tenant_id: registry.list(tenant_id),
        )

    def runtime_for(ctx: RunContext) -> LlmEmployeeRuntime:
        summary_tokens = int(os.getenv("MATE_AGENT_TEAM_SUMMARY_TOKENS", "100000"))
        return LlmEmployeeRuntime(
            registry=registry,
            llm_factory=_llm_for(ctx),
            toolbox_factory=lambda tenant_id: _toolbox(ctx),
            skills=skills,
            max_tool_rounds=int(os.getenv("MATE_AGENT_TEAM_MAX_TOOL_ROUNDS", "3")),
            summarization_trigger=("tokens", summary_tokens) if summary_tokens > 0 else None,
            # 1.2：实例层通道 —— 开跑前登记 team_task、每轮边界取走外部投递的
            # 消息（消费即清空）、跑完置终态。`TeamBus` 结构上就满足 TaskChannel。
            channel=team_bus,
        )

    return BrainService(
        planner_for=planner_for,
        runtime_for=runtime_for,
        checkpointer=PgCheckpointerProvider(required_dsn()),
        team_bus=team_bus or build_team_bus(registry),
        max_parallel=int(os.getenv("MATE_AGENT_TEAM_MAX_PARALLEL", "3")),
        # 1.5 任务 4：失败节点（运行时那一次调用）的重试策略。
        retry_policy=build_retry_policy(),
    )


def build_retry_policy() -> RetryPolicy:
    """重试策略（次数 / 退避基数）从环境变量来，缺省即可用。

    ``MATE_AGENT_TEAM_RETRY_ATTEMPTS`` 含首次尝试（1 = 不重试）；退避按
    ``base * 2^(n-1)`` 指数增长。
    """
    return RetryPolicy(
        max_attempts=int(os.getenv("MATE_AGENT_TEAM_RETRY_ATTEMPTS", str(DEFAULT_MAX_ATTEMPTS))),
        base_delay=float(
            os.getenv("MATE_AGENT_TEAM_RETRY_BACKOFF_SECONDS", str(DEFAULT_BACKOFF_SECONDS))
        ),
    )


__all__ = [
    "build_profile_store",
    "build_registry",
    "build_retry_policy",
    "build_team_bus",
    "build_service",
    "build_skill_catalog",
    "required_admin_dsn",
    "required_dsn",
]
