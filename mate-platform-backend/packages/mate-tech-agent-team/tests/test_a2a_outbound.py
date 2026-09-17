"""轨 2 · A2A 出站（外联）的验收用例（ADR-0066 §5.8 / §9-D）。

**A2A 的两条不变量必须写死在代码里、而不是写在注释里**（本文件就是那条断言）：

1. A2A Task **没有父子、没有深度**——团队那条 ``max_depth`` 闸门在 A2A 这条路上
   **无处可判**。所以出站信封里**不存在** depth / parentTaskId 这类字段；
   `DEPTH_PROPAGATED` / `PARENT_LINK_PROPAGATED` 为 `False` 是**可执行**的说明。
2. **终态 Task 不能再收消息**——`send` 式追问在 A2A 上只能被拒（409/refuse），
   不能假装投递成功。宁可抛错，也不要让一次追问静静落进虚空。

另有三条与其它运行时一致的判据：租户 fail-closed（硬规则 #3）、失败如实回执
（不编造产出）、产物读回 Team Bus 的回执形状。
"""

from __future__ import annotations

import os
from typing import Any

import pytest
from mate_tech_agent_team.a2a import (
    DEFAULT_A2A_ENDPOINT,
    A2AOutboundClient,
    A2AOutboundRequest,
    A2AOutboundResult,
    A2AOutboundRuntime,
    A2ATerminalTask,
    A2ATransport,
    build_a2a_outbound_client,
)
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileRegistry, RuntimeKind
from mate_tech_agent_team.state import SubTask

# ── 替身：A2A 传输面（真实现是 a2a-sdk，见 a2a/sdk.py）────────────────────


class FakeTransport:
    """确定性地回一份"外部 agent 的产物"，并记录出站信封（可断言不泄露深度）。"""

    def __init__(
        self,
        *,
        text: str = "对账结论：差异 3 笔，均为跨月挂账。",
        state: str = "TASK_STATE_COMPLETED",
        task_id: str = "remote-task-1",
        exc: Exception | None = None,
    ) -> None:
        self._text = text
        self._state = state
        self._task_id = task_id
        self._exc = exc
        self.sent: list[dict[str, Any]] = []

    async def send(self, *, endpoint: str, request: A2AOutboundRequest) -> A2AOutboundResult:
        self.sent.append({"endpoint": endpoint, **request.to_dict()})
        if self._exc is not None:
            raise self._exc
        return A2AOutboundResult(
            task_id=self._task_id,
            state=self._state,
            text=self._text,
            artifacts=({"name": "对账分析报告", "parts": [{"text": self._text}]},),
            ok=True,
        )


def _client(transport: Any, endpoint: str = "http://a2a-external-agent:8701") -> A2AOutboundClient:
    assert isinstance(transport, FakeTransport) or hasattr(transport, "send")
    return A2AOutboundClient(transport=transport, endpoint=endpoint)


# ── 判据 1：读回外部 agent 的产物 ────────────────────────────────────────


@pytest.mark.asyncio
async def test_delegate_reads_back_the_remote_artifact() -> None:
    transport = FakeTransport()
    result = await _client(transport).delegate(
        instruction="核对 Q3 应收对账差异", tenant_id="tenant-acme", role_slug="finance-recon"
    )

    assert isinstance(result, A2AOutboundResult)
    assert result.ok is True
    assert result.task_id == "remote-task-1"
    assert result.state == "TASK_STATE_COMPLETED"
    assert "差异 3 笔" in result.text
    assert result.artifacts[0]["name"] == "对账分析报告"
    # 出站信封：租户与角色随行（远端据此选 skill）
    assert transport.sent[0]["endpoint"] == "http://a2a-external-agent:8701"
    assert transport.sent[0]["tenantId"] == "tenant-acme"
    assert transport.sent[0]["roleSlug"] == "finance-recon"


def test_client_satisfies_the_transport_contract_shape() -> None:
    """`FakeTransport` 与真 SDK 传输都必须满足同一个本仓协议。"""
    assert hasattr(FakeTransport, "send")
    assert hasattr(A2ATransport, "send")


# ── 判据 2：A2A 没有深度/父子语义（不假装有）──────────────────────────────


def test_a2a_declares_that_depth_and_parentage_are_not_propagated() -> None:
    """ADR-0066 §9-D：团队协同塞不进 A2A。深度闸门在这条路上过不去，这是明说的。"""
    assert A2AOutboundClient.DEPTH_PROPAGATED is False
    assert A2AOutboundClient.PARENT_LINK_PROPAGATED is False


@pytest.mark.asyncio
async def test_the_outgoing_envelope_carries_no_topology_fields() -> None:
    """出站信封里**不存在** depth / parentTaskId —— 不是"传了但没用"，是根本没有。"""
    transport = FakeTransport()
    await _client(transport).delegate(instruction="干活", tenant_id="tenant-acme")
    envelope = transport.sent[0]

    for forbidden in ("depth", "parentTaskId", "parent_task_id", "maxDepth", "rootTaskId"):
        assert forbidden not in envelope, f"出站信封不该带 {forbidden}（A2A 无此语义）"
    # 只带 A2A 真的认识的那几样
    assert set(envelope) <= {"endpoint", "instruction", "tenantId", "roleSlug", "context"}


# ── 判据 3：终态 Task 的追问必须被拒，不许假装 ─────────────────────────────


@pytest.mark.asyncio
async def test_follow_up_on_a_terminal_task_is_refused() -> None:
    """A2A 的"终态 Task 不能再收消息"是协议不变量。

    本适配器**没有**"给已交付的任务追加一句话"这条路：要接着说，就新开一个
    Task。宁可明确抛错（映射 409），也不要让调用方以为追问被受理了。
    """
    transport = FakeTransport()
    client = _client(transport)
    with pytest.raises(A2ATerminalTask) as excinfo:
        await client.follow_up(
            task_id="remote-task-1", message="再补一个口径", tenant_id="tenant-acme"
        )

    message = str(excinfo.value)
    assert "终态" in message or "terminal" in message.lower()
    assert "新" in message, "拒绝时要给出出路：新开一个 Task"
    assert transport.sent == [], "被拒的追问不许出站"


# ── 判据 4：租户 fail-closed（硬规则 #3）──────────────────────────────────


@pytest.mark.asyncio
async def test_delegate_without_tenant_context_never_leaves_the_process() -> None:
    """跨租户 negative 的最强形态：**没有租户上下文就不出站**。

    A2A 是跨系统调用，出站一次就是一次对外动作——没有租户就别发。
    """
    transport = FakeTransport()
    with pytest.raises(ValueError):
        await _client(transport).delegate(instruction="干活", tenant_id="")
    assert transport.sent == [], "缺租户时竟然出站了"


@pytest.mark.asyncio
async def test_delegate_without_endpoint_is_fail_closed() -> None:
    transport = FakeTransport()
    with pytest.raises(ValueError):
        await _client(transport, endpoint="").delegate(instruction="干活", tenant_id="tenant-acme")
    assert transport.sent == []


@pytest.mark.asyncio
async def test_transport_failure_is_returned_not_swallowed() -> None:
    """远端炸了要如实回 ``ok=False`` + 错因，不许假装成功。"""
    transport = FakeTransport(exc=RuntimeError("connection reset by peer"))
    result = await _client(transport).delegate(instruction="干活", tenant_id="tenant-acme")
    assert result.ok is False
    assert result.text == ""
    assert "connection reset" in result.error


# ── 判据 5：产物读回 Team Bus 的回执形状 ─────────────────────────────────


class TenantScopedProfileStore:
    def __init__(self, rows: dict[tuple[str, str], EmployeeProfile]) -> None:
        self._rows = dict(rows)

    async def get(self, tenant_id: str, profile_id: str) -> EmployeeProfile | None:
        return self._rows.get((tenant_id, profile_id))

    async def list(self, tenant_id: str) -> list[EmployeeProfile]:
        return [p for (tenant, _), p in self._rows.items() if tenant == tenant_id]


_A2A_PROFILE = EmployeeProfile(
    profile_id="EMP-RECON",
    name="对账员",
    base_role="security",
    system_prompt="你是对账员。",
    tools=("ont_object_query",),
    runtimes=(RuntimeKind.SUPERAI, RuntimeKind.CLAUDE_CODE),
)


def _registry() -> ProfileRegistry:
    return ProfileRegistry(
        [], store=TenantScopedProfileStore({("tenant-acme", "EMP-RECON"): _A2A_PROFILE})
    )


def _subtask() -> SubTask:
    return SubTask(
        task_id="t1",
        team_task_id="run-abc12345-t1",
        profile_id="EMP-RECON",
        instruction="核对 Q3 应收对账差异",
        depends_on=[],
    )


def _runtime(transport: Any) -> A2AOutboundRuntime:
    return A2AOutboundRuntime(
        registry=_registry(), client=_client(transport), endpoint="http://a2a-external-agent:8701"
    )


@pytest.mark.asyncio
async def test_runtime_maps_the_remote_artifact_into_a_subtask_result() -> None:
    transport = FakeTransport()
    result = await _runtime(transport).run(subtask=_subtask(), tenant_id="tenant-acme")

    assert result["status"] == "ok"
    assert result["source"] == "external", "远端产物是外部 agent 产出的，不是我们的模型"
    # **判据 ④**：外部往返**不再计入** llm_calls。它单列在 external_agent_calls。
    assert result["llm_calls"] == 0, "外部 agent 的往返被记成本地模型轮次了（成本指标失真）"
    assert result["external_agent_calls"] == 1
    assert result["runtime_calls"] == 1
    assert result["output"] == "对账结论：差异 3 笔，均为跨月挂账。"
    assert result["output"] != _subtask()["instruction"]
    # 溯源：这一次产出是**经 A2A 出站**拿到的，地址可查
    (provenance,) = result["tool_calls"]
    assert provenance["name"] == "a2a.delegate"
    assert provenance["endpoint"] == "http://a2a-external-agent:8701"
    assert provenance["taskId"] == "remote-task-1"
    assert provenance["state"] == "TASK_STATE_COMPLETED"
    assert result["evidence"] == []


@pytest.mark.asyncio
async def test_runtime_reports_remote_failure_as_an_error_receipt() -> None:
    transport = FakeTransport(exc=RuntimeError("boom"))
    result = await _runtime(transport).run(subtask=_subtask(), tenant_id="tenant-acme")

    assert result["status"] == "error"
    assert result["output"] == "", "失败不许编造产出"
    assert result["llm_calls"] == 0
    # 成本口径问的是"打出去几次"，不是"成功几次"：往返已经发生过，就该记一次。
    assert result["external_agent_calls"] == 1
    assert "boom" in result["error"]


@pytest.mark.asyncio
async def test_a2a_round_trip_reports_the_truth_about_the_configured_endpoint() -> None:
    """**回执如实**的常跑用例 —— 不 skip、不伪造（判据 ④ 的外联面）。

    本机**没有真实对端**：``docker-compose.yml`` 里 ``a2a-external-agent`` 整段
    被注释，agent-team 也没设 ``MATE_AGENT_TEAM_A2A_URL``，于是默认端点指向一个
    不存在的服务。所以这条**不**断言"一定成功"——那是伪造证据。

    它断言的是**回执与事实一致**，两支都合法、都不许编造：

    * 通了 → ``status="ok"``、产出非空、计量记在 ``external_agent_calls``；
    * 没通 → ``status="error"``、``output`` 为空、``error`` 有值。

    对端真起来之后这条**一个字都不用改**就会走上面那一支：它验的是语义，
    不是环境。这正是 1.8 立下的"外部依赖写常跑用例、如实回执"的做法。
    """
    runtime = A2AOutboundRuntime(
        registry=_registry(),
        client=build_a2a_outbound_client(
            endpoint=os.getenv("MATE_AGENT_TEAM_A2A_URL", DEFAULT_A2A_ENDPOINT)
        ),
    )
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")

    assert result["llm_calls"] == 0, "外部往返永远不该记成本地模型轮次"
    if result["status"] == "ok":
        assert result["output"], "报成功却没有产出"
        assert result["external_agent_calls"] == 1
        assert result["source"] == "external"
    else:
        assert result["output"] == "", "报失败却编了产出"
        assert result["error"], "报失败却没说为什么"
        assert result["source"] == "stub", "没跑成就不许标成真实产出"


@pytest.mark.asyncio
async def test_runtime_does_not_delegate_a_profile_of_another_tenant() -> None:
    """跨租户 negative：名册里只在 acme 的员工，other 租户取不到 → 不派活。"""
    transport = FakeTransport()
    result = await _runtime(transport).run(subtask=_subtask(), tenant_id="tenant-other")

    assert result["status"] == "error"
    assert "员工不存在" in result["error"]
    assert transport.sent == [], "跨租户竟然把任务发出去了"


@pytest.mark.asyncio
async def test_runtime_is_fail_closed_without_tenant() -> None:
    transport = FakeTransport()
    result = await _runtime(transport).run(subtask=_subtask(), tenant_id="")
    assert result["status"] == "error"
    assert transport.sent == []


@pytest.mark.asyncio
async def test_the_role_slug_is_derived_from_the_profile_identity() -> None:
    """下投影的一部分：把员工身份映射成远端认识的 skill slug（本仓约定，非协议）。"""
    transport = FakeTransport()
    await _runtime(transport).run(subtask=_subtask(), tenant_id="tenant-acme")
    # base_role=security → finance-recon（见 a2a/outbound.py 的 DEFAULT_ROLE_SLUGS）
    assert transport.sent[0]["roleSlug"] == "finance-recon"


# ── 默认装配：端点可配（默认指向现有的 a2a-external-agent）────────────────


def test_default_client_points_at_the_configured_external_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MATE_AGENT_TEAM_A2A_URL", "http://a2a-external-agent:8701")
    pytest.importorskip("a2a", reason="a2a-sdk 未安装（真传输面）")
    client = build_a2a_outbound_client()
    assert isinstance(client, A2AOutboundClient)
    assert client.endpoint == "http://a2a-external-agent:8701"


def test_default_client_endpoint_falls_back_to_the_local_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("MATE_AGENT_TEAM_A2A_URL", raising=False)
    pytest.importorskip("a2a")
    client = build_a2a_outbound_client()
    assert client.endpoint == "http://localhost:8701"


# ── 真传输面：不 skip，断言"够不着外部 agent 时如实报错" ────────────────


def _closed_port() -> int:
    """要一个刚被释放的本机端口 —— 连它必然被**立刻拒绝**（不是超时，用例才快）。"""
    import socket

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.mark.asyncio
async def test_the_real_sdk_transport_reports_an_unreachable_agent_truthfully(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """对着一个**够不着**的端点出站：回执如实说"没成"，不抛、不编造。

    刻意**不 skip**（ADR-0015 规则 7：跑不了的用例要么修前置、要么删掉）。这条不
    需要"有一个活着的外部 agent"这个前置——它断言的性质在任何机器上都成立，同时
    是**真 a2a-sdk 传输面**在 CI 里的唯一接触点：桩用例验的是出站信封与结果映射，
    它验的是"a2a-sdk 还认不认这套调用"（SDK 换签名时桩用例不会响，它会）。

    真·端到端（对着活着的 ``a2a-external-agent``）是人工验证项：命令与实测结果
    记在 PR 里，不作为自动用例——那需要一个 CI 起不来的外部进程。
    """
    pytest.importorskip("a2a")
    monkeypatch.setenv("MATE_AGENT_TEAM_A2A_URL", f"http://127.0.0.1:{_closed_port()}")
    client = build_a2a_outbound_client()

    result = await client.delegate(
        instruction="核对 Q3 应收对账差异",
        tenant_id="tenant-acme",
        role_slug="finance-recon",
    )

    assert result.ok is False, result.to_dict()
    assert result.text.strip() == "", f"没够着却读回了产物：{result.to_dict()}"
    assert result.error, "没够着却没给错因"
