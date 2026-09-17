"""A-2 / `MP-RUN-DELEGATED-IDENTITY-01`：运行期委托身份（ADR-0067）。

判据（本文件逐条断言）：

1. **`委托 ⊆ 快照 ⊆ 当前权限`**（N2）—— 逐维取交集；当前权限涨了也不给；
   权限被撤空 → 没有可用授权。
2. **换回的令牌超出快照就拒签**（N2）—— 不把这条链交给 IdP 的配置去保证。
3. **每次重新评估**（N3）—— 令牌短寿命，且每次要用时现签。
4. **签不出就不假装**（N4）—— 未配置 / 换不到 / 被撤空 → ``user_token`` 为空 +
   可读原因，**绝不退回服务身份**。
5. **续跑真的以用户身份过上游** —— 续跑那一波里，运行时看到的 ``ctx.user_token``
   是**换来的委托令牌**（不是空、也不是发起用户的原令牌）。
6. **委托令牌零落库**（N1）—— 全量检查点 + 审计账本 + 产出物里一个字节都没有。
"""

from __future__ import annotations

import asyncio
import base64
import json
import time
from typing import Any

import pytest
from mate_tech_agent_team import (
    BrainService,
    Envelope,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.api.run_control import RunControl
from mate_tech_agent_team.delegated_identity import (
    DelegatedCredential,
    DelegationOutcome,
    KeycloakTokenExchangeIssuer,
    UnconfiguredIssuer,
)
from mate_tech_agent_team.delegation import RunDelegation, attenuate

TENANT = "tenant-acme"

SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})

DELEGATED_TOKEN = "delegated-token-" + "0f1e2d3c"

#: 登录用户的读基线（``authority._READ_BASELINE`` 的内容）——造令牌时用得上。
_READ_TOOLS = (
    "ont_list_classes",
    "ont_inspect_class",
    "ont_object_query",
    "search_skill",
    "read_skill",
)


# ── 造一枚"令牌"：只要有 payload 能被 claims_of 解出来（不验签，见 authority）──


def _jwt(
    *, roles: list[str] | None = None, permissions: list[str] | None = None, tenant: str = ""
) -> str:
    claims: dict[str, Any] = {"sub": "u-1", "realm_access": {"roles": roles or []}}
    if permissions:
        claims["permissions"] = permissions
    if tenant:
        claims["tenant_id"] = tenant
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode("utf-8")).decode("ascii")
    return f"header.{payload}.signature"


class _FakeResponse:
    def __init__(self, payload: dict[str, Any], status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


class _FakeHttpClient:
    """替身交易所：记下请求体，回一枚现造的令牌（或报错）。"""

    def __init__(self, *, token: str = "", payload: dict[str, Any] | None = None) -> None:
        self.requests: list[dict[str, str]] = []
        self._payload = (
            payload
            if payload is not None
            else {
                "access_token": token or _jwt(roles=["platform_user"]),
                "expires_in": 120,
            }
        )

    async def post(self, url: str, data: dict[str, str]) -> _FakeResponse:
        self.requests.append(dict(data, url=url))
        return _FakeResponse(self._payload)


def _issuer(client: _FakeHttpClient, **kwargs: Any) -> KeycloakTokenExchangeIssuer:
    kwargs.setdefault("ttl", 300.0)
    return KeycloakTokenExchangeIssuer(
        token_uri="http://keycloak.invalid/realms/probe/protocol/openid-connect/token",
        client_id="probe-client",
        client_secret="probe" + "-secret",
        service_token=lambda: "service-token-probe",
        client=client,  # type: ignore[arg-type]
        **kwargs,
    )


def _snapshot(
    *, tools: tuple[str, ...] = ("ont_list_classes",), subject: str = "u-1"
) -> RunDelegation:
    return RunDelegation.issue(
        run_id="run-a",
        envelope=Envelope(tools=frozenset(tools)),
        granted_by=subject,
        tenant_id=TENANT,
        policy_version="authority-envelope/v1",
    )


# ── 判据 1（N2）：衰减 ───────────────────────────────────────────────────


def test_attenuation_shrinks_the_snapshot_to_current_permissions() -> None:
    snapshot = _snapshot(tools=("ont_list_classes", "ont_object_query", "ont_merge_objects"))
    current = Envelope(tools=frozenset({"ont_list_classes", "ont_object_query"}))

    effective = attenuate(snapshot, current)
    assert effective.envelope.tools == {"ont_list_classes", "ont_object_query"}
    assert effective.revoked == ("tools",), "撤销的维度要说得出来，而不是只说'变小了'"
    assert not effective.is_empty


def test_attenuation_never_widens_when_current_permissions_grow() -> None:
    """当前权限**变大**也不给：委托只能 ⊆ 快照，涨回去等于绕过链。"""
    snapshot = _snapshot(tools=("ont_list_classes",))
    current = Envelope(tools=frozenset({"ont_list_classes", "ont_merge_objects"}))

    effective = attenuate(snapshot, current)
    assert effective.envelope.tools == {"ont_list_classes"}
    assert effective.revoked == ()


def test_attenuation_to_empty_means_no_authority() -> None:
    snapshot = _snapshot(tools=("ont_list_classes", "ont_object_query"))
    effective = attenuate(snapshot, Envelope())
    assert effective.is_empty
    assert effective.revoked == ("tools",)


def test_an_old_shape_snapshot_still_reads() -> None:
    """A-2 之前写下的快照（只有那四样）读得出来，判定结果不变。"""
    # 1.9 那时候真的就只有这四个键。
    old = {
        "run_id": "run-a",
        "granted_by": "u-1",
        "envelope": {"tools": ["ont_list_classes"]},
        "expires_at": 0.0,
    }
    restored = RunDelegation.of_state(old)
    assert restored is not None
    assert restored.authorizes("run-a") is True
    assert restored.envelope.tools == {"ont_list_classes"}
    assert restored.subject == "u-1", "subject_id 为空时退回 granted_by"
    assert restored.tenant_id == "" and restored.policy_version == ""
    # 追加字段之后**新写**的那一份也仍然只装这些料（精确集合，不是"看着像"）。
    assert set(_snapshot().as_state()) == {
        "run_id",
        "granted_by",
        "envelope",
        "expires_at",
        "tenant_id",
        "subject_id",
        "policy_version",
        "issued_at",
        "revocation_version",
    }


# ── 判据 2 / 3：签发面 ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unconfigured_issuer_denies_with_a_reason() -> None:
    outcome = await UnconfiguredIssuer().issue(_snapshot())
    assert not outcome.issued
    assert "未配置" in outcome.reason
    assert outcome.to_audit_detail()["issued"] is False


@pytest.mark.asyncio
async def test_a_subject_less_snapshot_is_not_delegated() -> None:
    """无令牌起的那一轮没有主体 —— 没有"以谁的名义"，就不该换出令牌来。"""
    outcome = await _issuer(_FakeHttpClient()).issue(_snapshot(subject=""))
    assert not outcome.issued
    assert "主体" in outcome.reason


@pytest.mark.asyncio
async def test_exchange_refuses_a_token_that_grants_more_than_the_snapshot() -> None:
    """换回的令牌带了快照里没有的能力 → **拒签**（N2 的关键负例）。"""
    wider = _jwt(roles=["PLATFORM_SUPER_ADMIN"], tenant=TENANT)
    client = _FakeHttpClient(token=wider)
    snapshot = _snapshot(tools=("ont_list_classes",))  # 快照故意很窄

    outcome = await _issuer(client).issue(snapshot)
    assert not outcome.issued, "比快照还大的令牌被照用了"
    assert "超出快照" in outcome.reason


@pytest.mark.asyncio
async def test_exchange_refuses_a_token_from_another_tenant() -> None:
    """权限对得上、租户对不上 → 拒签（换回的令牌不能跨租户用）。"""
    token = _jwt(roles=["platform_user"], tenant="tenant-somebody-else")
    # 快照要够宽（= 登录用户的读基线），否则会先被 N2 的"超出快照"挡下，
    # 这条用例就验不到租户那一步了。
    snapshot = _snapshot(tools=_READ_TOOLS)

    outcome = await _issuer(_FakeHttpClient(token=token)).issue(snapshot)
    assert not outcome.issued
    assert "租户" in outcome.reason


@pytest.mark.asyncio
async def test_a_failed_exchange_denies_instead_of_falling_back() -> None:
    """交易所不通 = 拒绝，**不是**退回服务身份（N4）。"""
    client = _FakeHttpClient(payload={"error": "invalid_grant"})
    outcome = await _issuer(client).issue(_snapshot())
    assert not outcome.issued
    assert "未返回可用令牌" in outcome.reason


@pytest.mark.asyncio
async def test_exchange_issues_a_short_lived_credential() -> None:
    """正例：换回的令牌 ⊆ 快照 → 发一份短期凭据，寿命取 **配置与 IdP 的较小者**。"""
    now = 1_000.0
    token = _jwt(roles=["platform_user"], tenant=TENANT)
    client = _FakeHttpClient(token=token, payload={"access_token": token, "expires_in": 120})
    issuer = _issuer(client, ttl=300.0)

    outcome = await issuer.issue(_snapshot(tools=_READ_TOOLS), now=now)
    assert outcome.issued
    credential = outcome.credential
    assert credential is not None
    assert credential.token == token
    assert credential.subject_id == "u-1"
    assert credential.expires_at == now + 120, "寿命应当取 IdP 给的（比配置更短）"
    assert credential.source == "keycloak-token-exchange"
    # 请求体真的是一次 RFC 8693 交换，且带上了主体
    body = client.requests[0]
    assert body["grant_type"] == "urn:ietf:params:oauth:grant-type:token-exchange"
    assert body["requested_subject"] == "u-1"
    assert body["subject_token"] == "service-token-probe"


@pytest.mark.asyncio
async def test_the_audit_detail_never_carries_the_token() -> None:
    token = _jwt(roles=["platform_user"], tenant=TENANT)
    outcome = await _issuer(_FakeHttpClient(token=token)).issue(_snapshot(tools=_READ_TOOLS))
    dumped = json.dumps(outcome.to_audit_detail(), ensure_ascii=False)
    assert token not in dumped
    assert "service-token-probe" not in dumped


# ── 判据 5 / 6：端到端（续跑）───────────────────────────────────────────


class _SlowRuntime:
    """每个员工睡一会儿 —— 给"死在员工波次在途"制造一个稳定的窗口。"""

    def __init__(self, delay: float = 0.3) -> None:
        self.delay = delay
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.started.append(subtask["task_id"])
        await asyncio.sleep(self.delay)
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _ChainPlanner(StaticPlanner):
    """两件串成一条链：t2 依赖 t1 —— 崩溃点钉在"第一波跑完、第二波在途"。"""

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del max_parallel, tenant_id
        return [
            SubTask(
                task_id="t1", profile_id="EMP-ANALYST", instruction=f"分析：{goal}", depends_on=[]
            ),
            SubTask(
                task_id="t2",
                profile_id="EMP-AUDITOR",
                instruction=f"复核：{goal}",
                depends_on=["t1"],
            ),
        ]


class _CapturingRuntime:
    """包一层：记下**每次运行时看到的 ctx**，再转给真运行时。"""

    def __init__(self, inner: Any, seen: list[Any]) -> None:
        self._inner = inner
        self._seen = seen

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        return await self._inner.run(subtask=subtask, tenant_id=tenant_id)


class _FakeIssuer:
    """可控签发面：签或拒，并记下被签的快照。"""

    def __init__(self, *, token: str = DELEGATED_TOKEN, deny: str = "") -> None:
        self.token = token
        self.deny = deny
        self.snapshots: list[RunDelegation] = []

    async def issue(
        self, snapshot: RunDelegation, *, now: float | None = None
    ) -> DelegationOutcome:
        del now
        self.snapshots.append(snapshot)
        if self.deny:
            return DelegationOutcome(reason=self.deny)
        return DelegationOutcome(
            credential=DelegatedCredential(
                token=self.token,
                subject_id=snapshot.subject,
                tenant_id=snapshot.tenant_id,
                envelope=snapshot.envelope,
                source="fake-exchange",
            )
        )


def _service(*, issuer: Any, runtime: Any, contexts: list[Any]) -> BrainService:
    return BrainService(
        planner_for=lambda _ctx: _ChainPlanner(),
        runtime_for=lambda ctx: contexts.append(ctx) or _CapturingRuntime(runtime, contexts),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
        delegation_issuer=issuer,
    )


async def _until(predicate, *, timeout: float = 8.0, interval: float = 0.01):  # type: ignore[no-untyped-def]
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = await predicate()
        if value:
            return value
        await asyncio.sleep(interval)
    return None


async def _has_result(service: BrainService, run_id: str, task_id: str) -> bool:
    state = await service.get(tenant_id=TENANT, run_id=run_id)
    return task_id in (state.get("results") or {})


async def _all_checkpoint_values(service: BrainService, run_id: str) -> list[dict[str, Any]]:
    """这一轮**每一份**检查点里的状态值——"零落库"要在全部历史快照上成立。"""
    cfg = service._config(TENANT, run_id)
    async with service._checkpointer.for_tenant(TENANT) as saver:
        graph = await service._graph_for(saver, service._context(tenant_id=TENANT), 3)
        return [dict(snap.values or {}) async for snap in graph.aget_state_history(cfg)]


async def _stuck_mid_flight(service: BrainService, control: RunControl, admin_token: str) -> str:
    """起一轮 → 等第一波落检查点 → 把进程拆掉，返回卡住的 run_id。"""
    run_id = str(
        (await control.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token))[
            "run_id"
        ]
    )
    assert await _until(lambda: _has_result(service, run_id, "t1")), "第一波没落检查点"
    await control.shutdown()
    stuck = await service.get(tenant_id=TENANT, run_id=run_id)
    assert stuck["status"] == "running", f"该死在这一轮的执行中：{stuck['status']}"
    return run_id


@pytest.mark.asyncio
async def test_a_resumed_run_calls_upstream_as_the_user(admin_token: str) -> None:
    """**主判据**：续跑那一波里，运行时看到的 ``user_token`` 是换来的委托令牌。"""
    issuer = _FakeIssuer()
    contexts: list[Any] = []
    runtime = _SlowRuntime()
    service = _service(issuer=issuer, runtime=runtime, contexts=contexts)
    control = RunControl(service)

    run_id = await _stuck_mid_flight(service, control, admin_token)
    await service.continue_run(tenant_id=TENANT, run_id=run_id)

    resumed = [ctx for ctx in contexts if ctx.user_token == DELEGATED_TOKEN]
    assert resumed, (
        "续跑那一波没有以用户身份上路：运行时的 ctx 里没有委托令牌"
        f"（看到的 user_token：{[c.user_token and 'set' for c in contexts]}）"
    )
    assert resumed[-1].delegation_source == "fake-exchange"
    assert resumed[-1].initiator_envelope.tools, "链根仍应来自本轮快照"
    assert issuer.snapshots, "根本没有找签发面要过令牌"
    assert issuer.snapshots[-1].run_id == run_id, "签发用的是别的 run 的快照"


@pytest.mark.asyncio
async def test_a_resumed_run_without_an_issuer_keeps_the_empty_token(admin_token: str) -> None:
    """N4：没有签发面时**绝不**退回服务身份 —— user_token 保持空，且说得出原因。"""
    contexts: list[Any] = []
    runtime = _SlowRuntime()
    service = _service(issuer=UnconfiguredIssuer(), runtime=runtime, contexts=contexts)
    control = RunControl(service)

    run_id = await _stuck_mid_flight(service, control, admin_token)
    await service.continue_run(tenant_id=TENANT, run_id=run_id)

    resumed = [ctx for ctx in contexts if ctx.delegation_reason]
    assert resumed, "续跑没有记下'为什么没有用户身份'"
    assert resumed[-1].user_token == "", "没有签发面却带上了令牌"
    assert "未配置" in resumed[-1].delegation_reason
    # 链根仍然成立（1.9 的语义不破）：那一波照样真跑。
    assert "t2" in runtime.started


@pytest.mark.asyncio
async def test_the_delegated_token_never_reaches_storage(admin_token: str) -> None:
    """N1：全量检查点 + 审计账本 + 产出物里，委托令牌一个字节都没有。"""
    issuer = _FakeIssuer()
    contexts: list[Any] = []
    service = _service(issuer=issuer, runtime=_SlowRuntime(), contexts=contexts)
    control = RunControl(service)

    run_id = await _stuck_mid_flight(service, control, admin_token)
    await service.continue_run(tenant_id=TENANT, run_id=run_id)

    snapshots = await _all_checkpoint_values(service, run_id)
    assert snapshots, "这一轮一份检查点都没有，用例前提不成立"
    audit_rows = await service.audit.records(tenant_id=TENANT)
    artifacts = await service._artifacts.list(TENANT, run_id)

    dumped = json.dumps(
        {
            "checkpoints": snapshots,
            "audit": [row.to_dict() for row in audit_rows],
            "artifacts": [row.to_dict() for row in artifacts],
        },
        ensure_ascii=False,
        default=str,
    )
    assert DELEGATED_TOKEN not in dumped, "委托令牌被落进了存储"
    assert admin_token not in dumped, "发起用户的原始令牌被落进了存储"
    # 审计行**记了这次签发**，但只记结论与原因（取证要的料，不含凭据）。
    delegations = [row for row in audit_rows if row.action == "agent_team.delegation"]
    assert delegations, "委托的签发没有落审计行"
    assert delegations[-1].outcome == "issued"
    assert delegations[-1].run_id == run_id
