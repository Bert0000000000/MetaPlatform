"""A2A 出站（外联）：把一份子任务交给**外部 A2A agent** 并读回它的产物。

本仓既有 ``mate-app-a2a``（内部 A2A 中心）与 ``a2a-external-agent``（真 A2A 1.0
端点）。本模块是**团队侧**的出站适配器：TeamBus 的五动作把 ``external_a2a`` 当成
一种 ``RuntimeKind`` 看待（ADR-0066 §9-D），于是"派给外部 agent"与"派给本仓员工"
在调用面上等价。

**两条 A2A 不变量写死在代码里，不写在注释里**：

1. **A2A Task 没有父子、没有深度**（§9-D）。团队那条 ``max_depth`` 闸门在 A2A 这条
   路上**无处可判**——出站信封里根本就没有 depth / parentTaskId 这类字段
   （:data:`A2AOutboundClient.DEPTH_PROPAGATED` = ``False`` 是可执行的说明，
   不是一句注释）。
2. **终态 Task 不能再收消息**。所以 :meth:`A2AOutboundClient.follow_up` **直接拒**
   （映射 409）：要让远端接着干，就**新开一个 Task**——绝不假装投递成功
   （那会让"追问过了"变成一句没有回执的谎）。

**传输面在 adapter 之后**（R10 的同一精神）：本模块只定义**本仓类型**
（``A2AOutboundRequest`` / ``A2AOutboundResult`` / ``A2ATransport``），官方 ``a2a-sdk``
只出现在 :mod:`.sdk` 里、且是惰性 import——没装 a2a-sdk 也不影响本模块可用。

**边界登记**：

* 出站**没有**深度/父子信息可传，因此**跨系统的深度闸门不存在**；调用方若需要
  "不许再往外派"，只能在本地策略里拦（本切片没做）。
* **没有** heartbeat / 长任务轮询：一次 ``delegate`` 就是一次同步往返。
  B-7 的"长任务部分"因此**缓做**——本机没有真实对端（compose 里
  ``a2a-external-agent`` 整段被注释），给不存在的对端写状态轮询/中途取消是空转。
  已做的是**计量拆分**（下面那段），因为那是个真 bug 而不是新功能。
* 远端产物**不做**证据映射（``evidence=[]``）：A2A 的 artifact 不是本仓工具结果，
  按本仓证据形状硬套就是编造。
* **计量拆开**（B-7 / `MP-EXTERNAL-RUNTIME-E2E-01`）：出站往返记
  ``external_agent_calls`` / ``runtime_calls``，**不再**记 ``llm_calls``——
  远端的 token 不是我们花的，本地一次模型调用都没发生。
"""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, NoReturn, Protocol

from ..profiles import EmployeeProfile, ProfileNotFound, ProfileRegistry
from ..state import SubTask, SubTaskResult

#: 默认端点 = 既有的 ``a2a-external-agent`` 服务（skills: finance-recon /
#: kb-curator / data-analyst）。可用 ``MATE_AGENT_TEAM_A2A_URL`` 覆盖。
DEFAULT_A2A_ENDPOINT = "http://localhost:8701"

#: ``base_role`` → 远端 skill slug 的**本仓约定**（不是 A2A 协议的一部分）。
#: 远端 ``a2a-external-agent`` 从消息 metadata 的 ``role_slug`` 里挑 skill；
#: 本仓的身份是 ``base_role``，两者之间要有一张表。认不出来就落到 ``kb-curator``
#: ——**不猜**（猜错 skill 比落回通用 skill 更糟）。
DEFAULT_ROLE_SLUGS: Mapping[str, str] = {
    "security": "finance-recon",
    "knowledge": "kb-curator",
    "ontology": "data-analyst",
    "workflow": "data-analyst",
    "app": "kb-curator",
    "data": "data-analyst",
    "obs": "data-analyst",
}
FALLBACK_ROLE_SLUG = "kb-curator"


class A2ATerminalTask(RuntimeError):
    """终态 A2A Task 不能再收消息（映射 409，ADR-0066 §5.5 的对外版本）。

    A2A 协议里任务一旦到终态，投递**没有**语义落脚点。宁可抛这个错，也不要让
    调用方以为"追问被受理了"。
    """


@dataclass(frozen=True, slots=True)
class A2AOutboundRequest:
    """一次出站请求的**本仓**形态（不是 A2A 的 protobuf 类型）。

    **刻意没有** ``depth`` / ``parent_task_id`` 字段——A2A 没有这两个概念，
    加进来只会让人以为"深度传过去了"。
    """

    instruction: str
    tenant_id: str
    role_slug: str = ""
    context: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """出站信封（线格式的字段名与远端约定一致）。"""
        return {
            "instruction": self.instruction,
            "tenantId": self.tenant_id,
            "roleSlug": self.role_slug,
            "context": dict(self.context),
        }


@dataclass(frozen=True, slots=True)
class A2AOutboundResult:
    """远端回的产物（本仓形态）。

    ``ok=False`` 时 ``error`` 必有值、``text`` 必为空——"失败"与"跑出空产出"
    是两件事，不许混淆。
    """

    task_id: str = ""
    state: str = ""
    text: str = ""
    artifacts: tuple[dict[str, Any], ...] = ()
    ok: bool = True
    error: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "taskId": self.task_id,
            "state": self.state,
            "text": self.text,
            "artifacts": [dict(a) for a in self.artifacts],
            "ok": self.ok,
            "error": self.error,
        }


class A2ATransport(Protocol):
    """A2A 传输面（真实现见 :mod:`.sdk`；测试注入替身）。

    只依赖本仓的两个类型——**协议在这里，SDK 在它后面**。
    """

    async def send(self, *, endpoint: str, request: A2AOutboundRequest) -> A2AOutboundResult: ...


class A2AOutboundClient:
    """对**外部** A2A agent 的出站客户端。"""

    #: A2A 没有父子/深度语义——这两个常量是"深度闸门过不去 A2A"的可执行说明。
    DEPTH_PROPAGATED: bool = False
    PARENT_LINK_PROPAGATED: bool = False

    def __init__(self, *, transport: A2ATransport, endpoint: str = "") -> None:
        self._transport = transport
        self._endpoint = endpoint

    @property
    def endpoint(self) -> str:
        """外部 agent 的地址（A2A agent card 的发现入口）。"""
        return self._endpoint

    async def delegate(
        self,
        *,
        instruction: str,
        tenant_id: str,
        role_slug: str = "",
        context: Mapping[str, Any] | None = None,
    ) -> A2AOutboundResult:
        """把一份子任务发给外部 agent 并读回产物。

        **fail-closed**：没有租户上下文 / 没有端点 / 没有指令 —— 一律在**出站之前**
        抛错。A2A 是一次跨系统的对外动作，"没有租户也发出去"是不能接受的
        （硬规则 #3）。

        传输面的失败被收敛成 ``ok=False`` 的回执（而不是往上抛异常）：调用方要的是
        "这一件干没干成"的答案，不是一次栈展开。
        """
        if not tenant_id:
            raise ValueError("A2A 出站必须带租户上下文（硬规则 #3）：tenant_id 为空")
        if not self._endpoint:
            raise ValueError("A2A 出站必须配置端点（agent card URL）")
        if not instruction.strip():
            raise ValueError("A2A 出站的指令为空")

        request = A2AOutboundRequest(
            instruction=instruction,
            tenant_id=tenant_id,
            role_slug=role_slug,
            context=dict(context or {}),
        )
        try:
            return await self._transport.send(endpoint=self._endpoint, request=request)
        except Exception as exc:
            return A2AOutboundResult(ok=False, error=f"{type(exc).__name__}: {exc}")

    async def follow_up(self, *, task_id: str, message: str, tenant_id: str) -> NoReturn:
        """给一个**已交付**的 A2A Task 追加消息 —— 一律拒绝。

        A2A 的终态 Task 不再接受消息（协议不变量）。本适配器**不提供**这条捷径：
        要让远端接着干活，请 ``delegate`` 一个新任务。抛 :class:`A2ATerminalTask`
        让调用方（HTTP 面）映射 409，而不是让一次投递落进虚空。
        """
        raise A2ATerminalTask(
            f"A2A 任务 {task_id} 是外部执行面，终态后不能再收消息（A2A 协议不变量）；"
            "要接着做请新开一个 Task（重新 delegate），本适配器不会隐式续跑。"
        )


# ── 出站运行时：A2A 产物 → TeamBus 回执形状 ────────────────────────────


class A2AOutboundRuntime:
    """把 ``external_a2a`` 当成一种 ``RuntimeKind`` 用的员工运行时。

    与 ``LlmEmployeeRuntime`` / ``ClaudeCodeRuntime`` 同协议：拿一份子任务，回一份
    ``SubTaskResult``。产出的 ``source`` 是 ``"llm"``——远端 agent 的 artifact 是
    **真实产出**，不是占位（本仓 ``source`` 只有 ``llm``/``stub`` 两档，
    ``state.py`` 不在本切片可改范围，故不新增取值）。
    """

    def __init__(
        self,
        *,
        registry: ProfileRegistry,
        client: A2AOutboundClient,
        endpoint: str = "",
        role_slug_for: Callable[[EmployeeProfile], str] | None = None,
    ) -> None:
        self._registry = registry
        self._client = client
        self._endpoint = endpoint or client.endpoint
        self._role_slug_for = role_slug_for or _default_role_slug

    def _receipt(self, subtask: SubTask) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask.get("task_id", ""),
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask.get("profile_id", ""),
            status="error",
            output="",
            tool_calls=[],
            llm_calls=0,
            external_agent_calls=0,
            runtime_calls=0,
            source="stub",
            error="",
            evidence=[],
        )

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        result = self._receipt(subtask)
        if not tenant_id:
            # 硬规则 #3：没有租户上下文就**不出站**（连员工都不查）。
            result["error"] = "缺少租户上下文（硬规则 #3）：A2A 出站被拒"
            return result
        try:
            profile = await self._registry.get(subtask["profile_id"], tenant_id)
        except ProfileNotFound:
            result["error"] = f"员工不存在：{subtask['profile_id']}（租户 {tenant_id}）"
            return result

        result["profile_id"] = profile.profile_id
        allowed = tuple(subtask.get("granted_tools") or profile.tools)
        try:
            outcome = await self._client.delegate(
                instruction=subtask["instruction"],
                tenant_id=tenant_id,
                role_slug=self._role_slug_for(profile),
                context={
                    # 下投影的一部分：远端据此知道"这是谁在派活"，
                    # 但**不带** depth/parent——A2A 没有这两个概念。
                    "profileId": profile.profile_id,
                    "toolScope": list(allowed),
                },
            )
        except ValueError as exc:
            result["error"] = f"{type(exc).__name__}: {exc}"
            return result

        # 出站往返**发生过**了（不管远端判成功还是失败）——计量记在拿到返回值
        # 之后、判定之前。成本口径问的是"打出去几次"，不是"成功几次"。
        result["external_agent_calls"] = 1
        result["runtime_calls"] = 1

        if not outcome.ok:
            result["error"] = outcome.error or "A2A 出站失败"
            return result

        result["status"] = "ok"
        result["output"] = outcome.text
        # **计量拆开**（B-7 / `MP-EXTERNAL-RUNTIME-E2E-01`）：这一次是**出站到
        # 外部 agent**，不是本地模型轮次。记成 ``llm_calls=1`` 会让成本指标失真
        # ——远端的 token 不是我们花的，本地一次模型调用都没发生。
        result["source"] = "external"
        result["llm_calls"] = 0
        result["tool_calls"] = [
            {
                "name": "a2a.delegate",
                "arguments": {"roleSlug": self._role_slug_for(profile)},
                "allowed": True,
                "endpoint": self._endpoint,
                "taskId": outcome.task_id,
                "state": outcome.state,
            }
        ]
        return result


def _default_role_slug(profile: EmployeeProfile) -> str:
    return DEFAULT_ROLE_SLUGS.get(profile.base_role, FALLBACK_ROLE_SLUG)


def build_a2a_outbound_client(
    *, endpoint: str | None = None, transport: A2ATransport | None = None
) -> A2AOutboundClient:
    """按环境装配出站客户端。

    真传输面（``a2a-sdk``）是**惰性** import：没装 a2a-sdk 时，本模块与注入替身的
    调用方照样可用（这正是"SDK 待在 adapter 之后"的实际好处）。
    """
    url = endpoint or os.getenv("MATE_AGENT_TEAM_A2A_URL", DEFAULT_A2A_ENDPOINT)
    if transport is None:
        from .sdk import SdkA2ATransport  # 惰性：见 docstring

        transport = SdkA2ATransport()
    return A2AOutboundClient(transport=transport, endpoint=url)


__all__ = [
    "DEFAULT_A2A_ENDPOINT",
    "DEFAULT_ROLE_SLUGS",
    "FALLBACK_ROLE_SLUG",
    "A2AOutboundClient",
    "A2AOutboundRequest",
    "A2AOutboundResult",
    "A2AOutboundRuntime",
    "A2ATerminalTask",
    "A2ATransport",
    "build_a2a_outbound_client",
]
