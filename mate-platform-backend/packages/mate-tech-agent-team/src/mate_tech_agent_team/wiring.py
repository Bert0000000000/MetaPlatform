"""生产装配：把大脑接上真实的 llmgw / MCP 中心 / SkillHub / PG 检查点。

本体不在这里单接：本体工具经 MCP 总线（1.1 task 1c 起 MCP 代理逐请求透传
调用方 token + 租户）。

**刻意没有静默回落**（硬规则 #5 的同一精神）：缺 ``MATE_AGENT_TEAM_DSN``
或 ``MATE_AGENT_TEAM_ADMIN_DSN`` 时**直接启动失败**，而不是悄悄退回内存
检查点器或用服务身份冒名建表——那会让"租户隔离由数据库强制"变成一句空话。
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

from mate_clients.iam import IamServiceReadClient
from mate_clients.llmgw import LlmgwClient
from mate_clients.mcp.tools import McpToolsClient
from mate_clients.security import BearerAuth
from mate_platform.marketplace.skillhub.store import SkillHubStore

from .a2a.outbound import A2AOutboundRuntime, build_a2a_outbound_client
from .artifact_store import PgArtifacts
from .brain import BrainService, RunContext
from .checkpoint import SCHEMA as CHECKPOINT_SCHEMA
from .checkpoint import PgCheckpointerProvider, bootstrap
from .employee import LlmEmployeeRuntime
from .llm_planner import LlmPlanner
from .profile_store import ProfileStore
from .profiles import ProfileNotFound, ProfileRegistry, RuntimeKind
from .retry import DEFAULT_BACKOFF_SECONDS, DEFAULT_MAX_ATTEMPTS, RetryPolicy
from .runtime import EmployeeRuntime
from .runtimes import ClaudeCodeProjection, ClaudeCodeRuntime
from .skill_toolbox import SKILL_TOOL_NAMES, SkillToolbox
from .skills import SkillCatalog
from .state import SubTask, SubTaskResult
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


def build_artifact_store() -> PgArtifacts:
    """产出物（artifact）落库面（1.6 任务 2）。

    与检查点 / 员工定义 / 任务实例**同库同 schema**：租户隔离靠同一套 RLS 强制，
    不必为"交付物"另建一条隔离路径（理由详见 :mod:`.artifact_store` 的模块注释）。
    """
    return PgArtifacts(required_dsn(), schema=CHECKPOINT_SCHEMA)


# ── 执行面路由（ADR-0066 §5.8：角色 × 运行时正交两轴）──────────────────────

#: env 里能写出来的执行面名字 → ``RuntimeKind``。**这是白名单**：写错一个名字
#: 直接启动失败，而不是"看不懂就当你没配"（后者会让一个已经下放给外部执行面的
#: 员工悄悄跑回 superai）。
ROUTABLE_RUNTIMES: Mapping[str, RuntimeKind] = {
    "superai": RuntimeKind.SUPERAI,
    "claude_code": RuntimeKind.CLAUDE_CODE,
    "external_a2a": RuntimeKind.EXTERNAL_A2A,
}


def enabled_runtime_kinds() -> tuple[RuntimeKind, ...]:
    """从 ``MATE_AGENT_TEAM_RUNTIMES`` 读**允许被路由到**的执行面（逗号分隔）。

    **默认空 = 不启用路由**：没配这个变量的部署，``runtime_for`` 仍旧直接返回
    ``LlmEmployeeRuntime``——行为与加这个特性之前逐字一致（这是"存量不动"的保证）。
    """
    raw = os.getenv("MATE_AGENT_TEAM_RUNTIMES", "").strip()
    if not raw:
        return ()
    kinds: list[RuntimeKind] = []
    for token in raw.split(","):
        name = token.strip().lower()
        if not name:
            continue
        kind = ROUTABLE_RUNTIMES.get(name)
        if kind is None:
            raise RuntimeError(
                f"MATE_AGENT_TEAM_RUNTIMES 里有未知的执行面：{name!r}"
                f"（可选：{sorted(ROUTABLE_RUNTIMES)}）"
            )
        if kind not in kinds:
            kinds.append(kind)
    return tuple(kinds)


class RuntimeRouter:
    """按 ``profile.runtimes`` 挑执行面的路由器（``EmployeeRuntime`` 协议）。

    **为什么需要它**：`EmployeeProfile` 同时带「角色」与「执行面」两轴（§5.8）。
    没有路由器时，员工声明 ``runtimes=(CLAUDE_CODE,)`` 也只会跑在 superai 上——
    声明变成了装饰品。

    **不做静默回落**：员工声明的执行面一个都没装配 → 如实报 ``status="error"``，
    **不**换个执行面把它跑掉。悄悄换地方跑会让"这个员工跑在哪"失去意义，而且不同
    执行面的沙箱与权限假设完全不同（外部 CLI 拿不到本仓的 ``EnvelopeGate``）。

    ``ProfileNotFound`` 交给 ``default``（= superai）去报：错误措辞与既有回执逐字
    一致，不在这里另造一种"员工不存在"。
    """

    def __init__(
        self,
        *,
        registry: ProfileRegistry,
        runtimes: Mapping[RuntimeKind, EmployeeRuntime],
        default: EmployeeRuntime | None = None,
    ) -> None:
        self._registry = registry
        self._runtimes = dict(runtimes)
        self._default = default

    @property
    def available(self) -> tuple[RuntimeKind, ...]:
        """已装配的执行面（可读，便于运维核对 env 配对了没）。"""
        return tuple(self._runtimes)

    def _kind_of(self, raw: Any) -> RuntimeKind | None:
        """容忍 profile 里存的是字符串（库里/JSON 来的 ``"claude_code"``）。

        ``RuntimeKind`` 是 ``StrEnum``，字典按 hash 查字符串键本来就成立；这里显式
        转一次是为了让"库里存了拼错的枚举值"变成一次可读的 TypeError，而不是静默
        选不中。
        """
        if isinstance(raw, RuntimeKind):
            return raw
        try:
            return RuntimeKind(str(raw))
        except ValueError:
            return None

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        try:
            profile = await self._registry.get(subtask["profile_id"], tenant_id)
        except ProfileNotFound:
            if self._default is None:
                return SubTaskResult(
                    task_id=subtask.get("task_id", ""),
                    team_task_id=subtask.get("team_task_id", ""),
                    profile_id=subtask.get("profile_id", ""),
                    status="error",
                    output="",
                    source="stub",
                    llm_calls=0,
                    tool_calls=[],
                    evidence=[],
                    error=f"员工不存在：{subtask['profile_id']}（租户 {tenant_id}）",
                )
            return await self._default.run(subtask=subtask, tenant_id=tenant_id)

        declared = profile.runtimes or (RuntimeKind.SUPERAI,)
        for raw in declared:
            kind = self._kind_of(raw)
            runtime = None if kind is None else self._runtimes.get(kind)
            if runtime is not None:
                return await runtime.run(subtask=subtask, tenant_id=tenant_id)

        names = "、".join(str(r) for r in declared)
        return SubTaskResult(
            task_id=subtask.get("task_id", ""),
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=profile.profile_id,
            status="error",
            output="",
            source="stub",
            llm_calls=0,
            tool_calls=[],
            evidence=[],
            error=(
                f"该员工声明的执行面都没有装配：{names}；"
                f"本部署可用的是：{'、'.join(str(k) for k in self.available) or '（空）'}。"
                "（不会换一个执行面代跑——那样执行面的沙箱/权限假设就失效了）"
            ),
        )


def build_runtime_router(
    *,
    registry: ProfileRegistry,
    superai: EmployeeRuntime,
    kinds: tuple[RuntimeKind, ...],
    skills: SkillCatalog | None = None,
    working_root: str | os.PathLike[str] | None = None,
) -> RuntimeRouter:
    """按 ``kinds`` 装配路由器。

    ``superai`` 由调用方传入（它是既有那个 ``LlmEmployeeRuntime`` 实例，必须与
    HTTP 面看到的是同一个）；``claude_code`` / ``external_a2a`` 在这里现建——
    它们的依赖（投影 / 出站客户端）只有这里知道怎么接。
    """
    runtimes: dict[RuntimeKind, EmployeeRuntime] = {}
    if RuntimeKind.SUPERAI in kinds:
        runtimes[RuntimeKind.SUPERAI] = superai
    if RuntimeKind.CLAUDE_CODE in kinds:
        runtimes[RuntimeKind.CLAUDE_CODE] = ClaudeCodeRuntime(
            registry=registry,
            projection=ClaudeCodeProjection(skills=skills),
            working_root=working_root,
            cli_model=os.getenv("MATE_AGENT_TEAM_CLAUDE_MODEL", ""),
            timeout=float(os.getenv("MATE_AGENT_TEAM_CLAUDE_TIMEOUT", "300")),
        )
    if RuntimeKind.EXTERNAL_A2A in kinds:
        runtimes[RuntimeKind.EXTERNAL_A2A] = build_a2a_outbound_runtime(registry=registry)
    return RuntimeRouter(registry=registry, runtimes=runtimes, default=superai)


def build_a2a_outbound_runtime(*, registry: ProfileRegistry) -> A2AOutboundRuntime:
    """外部 A2A agent 的运行时（ADR-0066 §9-D 的 ``runtime_kind=external_a2a``）。

    端点取 ``MATE_AGENT_TEAM_A2A_URL``（默认指向既有的 ``a2a-external-agent``）。
    出站客户端本身是惰性的（``a2a-sdk`` 只在真正发消息时才会被 import）。
    """
    client = build_a2a_outbound_client()
    return A2AOutboundRuntime(registry=registry, client=client)


def build_service(
    *,
    registry: ProfileRegistry | None = None,
    team_bus: TeamBus | None = None,
    artifacts: PgArtifacts | None = None,
) -> BrainService:
    """按环境变量装配。容器启动时调用一次。

    ``team_bus`` 必须与 HTTP 面用的是**同一个实例**——投递方往它的 inbox 写、
    员工从它的 inbox 取，两个实例等于两个信箱。``artifacts`` 同理：图往里写、
    接口从它读，两个实例等于两个库。
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
                # 员工产出**不许**是"把指令抄回来"的假回执。llmgw 在上游不可用时
                # 默认会回显输入并让员工 status=ok —— 那正是 1.0 立项要治的东西。
                # 这里关掉：宁可该员工如实失败，也不要一个像结论的假答复。
                # 顺带堵住另一条路：provider 配置取数失败时 _resolved_provider()
                # 退回空配置，过去同样落到回显。
                allow_stub_fallback=False,
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

    def runtime_for(ctx: RunContext) -> EmployeeRuntime:
        summary_tokens = int(os.getenv("MATE_AGENT_TEAM_SUMMARY_TOKENS", "100000"))
        superai = LlmEmployeeRuntime(
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
        # 1.8 轨 2：执行面路由（ADR-0066 §5.8）。**默认关闭** —— 没配
        # `MATE_AGENT_TEAM_RUNTIMES` 的部署拿到的还是上面那个 superai 运行时，
        # 行为与加这个特性之前逐字一致。
        kinds = enabled_runtime_kinds()
        if not kinds:
            return superai
        return build_runtime_router(
            registry=registry,
            superai=superai,
            kinds=kinds,
            skills=skills,
            working_root=os.getenv("MATE_AGENT_TEAM_RUNTIME_ROOT") or None,
        )

    return BrainService(
        planner_for=planner_for,
        runtime_for=runtime_for,
        checkpointer=PgCheckpointerProvider(required_dsn()),
        team_bus=team_bus or build_team_bus(registry),
        artifacts=artifacts or build_artifact_store(),
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
    "ROUTABLE_RUNTIMES",
    "RuntimeRouter",
    "build_a2a_outbound_runtime",
    "build_artifact_store",
    "build_profile_store",
    "build_registry",
    "build_retry_policy",
    "build_runtime_router",
    "build_team_bus",
    "build_service",
    "build_skill_catalog",
    "enabled_runtime_kinds",
    "required_admin_dsn",
    "required_dsn",
]
