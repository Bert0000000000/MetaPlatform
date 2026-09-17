"""1.4 任务 3 · 审批角色与审计（硬规则 #9）。

两件"建了但没兜住"的事：

1. **审批没有角色**——1.3 的 ``POST /runs/{id}/approve`` 认令牌不认角色，
   任何登录用户都能确认一轮越权计划；
2. **动作没有审计**——派活 / 越权转 proposal / 审批三件事一件都不落行，
   事后问"谁批的、批了什么"答不上来。

做法**复刻既有平台**：角色守卫照 ``mate_platform.tenancy.guards`` 的
``require_tenant`` / ``is_cross_tenant_admin`` 那一套（``RequestContext.roles``
＋ ``require_*`` 抛异常），审计照 ``ActionService._audit`` 那一套（类型化记录 ＋
append-only ＋ 可列举）。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    APPROVER_ROLES,
    AUDIT_APPROVAL,
    AUDIT_ESCALATION,
    AUDIT_SPAWN,
    AuditLog,
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.authority import Envelope
from mate_tech_agent_team.main import create_app
from mate_tech_agent_team.profiles import EmployeeProfile
from mate_tech_agent_team.team_bus import SpawnRequest

from mate_platform.tenancy.context import AuthMethod, RequestContext
from mate_platform.tenancy.guards import ApprovalRoleError, is_approver, require_approver

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"


# ── 角色守卫 ─────────────────────────────────────────────────────────────


def _ctx(roles: tuple[str, ...]) -> RequestContext:
    return RequestContext(
        request_id="req-1",
        trace_id="trace-1",
        tenant_id=TENANT,
        user_id="u-1",
        auth_method=AuthMethod.USER,
        roles=frozenset(roles),
        permissions=frozenset(),
    )


def test_approver_roles_are_the_platform_admin_roles() -> None:
    """审批角色复用平台既有角色名（ADR-0066 §3.7 的 agent_admin + 平台管理员）。"""
    assert {"agent_admin", "platform_admin", "PLATFORM_ADMIN", "PLATFORM_SUPER_ADMIN"} <= set(
        APPROVER_ROLES
    )


def test_plain_user_is_not_an_approver() -> None:
    assert is_approver(_ctx(("platform_user",))) is False


def test_agent_admin_is_an_approver() -> None:
    assert is_approver(_ctx(("agent_admin",))) is True


def test_require_approver_raises_for_a_plain_user() -> None:
    with pytest.raises(ApprovalRoleError):
        require_approver(_ctx(("platform_user",)))


def test_require_approver_passes_for_an_approver() -> None:
    require_approver(_ctx(("agent_admin",)))


# ── HTTP：无审批角色者 approve 被拒 ──────────────────────────────────────


class _Runtime:
    async def run(self, *, subtask, tenant_id: str) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask["task_id"],
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            source="llm",
            llm_calls=1,
        )


@pytest.fixture
def client() -> TestClient:
    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _Runtime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    return TestClient(create_app(service=service))


@pytest.fixture
def viewer_headers(issue_token) -> dict[str, str]:
    """登录了、但没有审批角色的用户。"""
    return {"Authorization": f"Bearer {issue_token(roles=['platform_user'])}"}


def test_approve_without_an_approver_role_is_forbidden(
    client: TestClient, auth_headers: dict[str, str], viewer_headers: dict[str, str]
) -> None:
    run = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers
    ).json()

    denied = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=viewer_headers
    )
    assert denied.status_code == 403, denied.text
    assert denied.json()["detail"]["code"] == "E_NOT_APPROVER"


def test_a_denied_approval_does_not_change_the_run(
    client: TestClient, auth_headers: dict[str, str], viewer_headers: dict[str, str]
) -> None:
    """403 之后 run 仍在待确认——拒绝不是"悄悄批准"。"""
    run = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers
    ).json()
    client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=viewer_headers
    )
    state = client.get(f"{BASE}/runs/{run['run_id']}", headers=auth_headers).json()
    assert state["status"] == "awaiting_approval"


def test_an_approver_can_still_approve(client: TestClient, auth_headers: dict[str, str]) -> None:
    run = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers
    ).json()
    approved = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=auth_headers
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "completed"


# ── 审计行 ───────────────────────────────────────────────────────────────


@dataclass
class _Registry:
    profiles: list[EmployeeProfile]

    async def get(self, profile_id: str, tenant_id: str = "") -> EmployeeProfile:
        for p in self.profiles:
            if p.profile_id == profile_id:
                return p
        from mate_tech_agent_team.profiles import ProfileNotFound

        raise ProfileNotFound(profile_id)

    async def list(self, tenant_id: str = "") -> list[EmployeeProfile]:
        return list(self.profiles)


def _profile(profile_id: str, **overrides: Any) -> EmployeeProfile:
    base: dict[str, Any] = {
        "profile_id": profile_id,
        "name": profile_id,
        "base_role": "ontology",
        "system_prompt": "你是子员工。",
        "tools": ("ont_object_query",),
    }
    base.update(overrides)
    return EmployeeProfile(**base)  # type: ignore[arg-type]


USER_ENVELOPE = Envelope(tools=frozenset({"ont_object_query"}))


def _request(**overrides: Any) -> SpawnRequest:
    base: dict[str, Any] = {
        "tenant_id": TENANT,
        "profile_id": "EMP-CHILD",
        "initiator_envelope": USER_ENVELOPE,
        "instruction": "核对本月差异项",
        "depth": 1,
        "run_id": "run-abc123",
    }
    base.update(overrides)
    return SpawnRequest(**base)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_every_spawn_writes_an_audit_row() -> None:
    bus = TeamBus(registry=_Registry([_profile("EMP-CHILD")]))
    outcome = await bus.spawn(_request(actor="u-1"))

    rows = bus.audit.records(tenant_id=TENANT)
    assert [r.action for r in rows] == [AUDIT_SPAWN]
    assert rows[0].task_id == outcome.task_id
    assert rows[0].actor == "u-1"
    assert rows[0].outcome == "granted"
    assert rows[0].run_id == "run-abc123"


@pytest.mark.asyncio
async def test_escalation_writes_its_own_audit_row() -> None:
    """越权转 proposal —— 这是最需要事后追责的一类。"""
    bus = TeamBus(
        registry=_Registry([_profile("EMP-CHILD", tools=("ont_object_query", "ont_merge_objects"))])
    )
    await bus.spawn(_request(actor="u-1"))

    rows = bus.audit.records(tenant_id=TENANT)
    escalation = [r for r in rows if r.action == AUDIT_ESCALATION]
    assert len(escalation) == 1, rows
    assert escalation[0].outcome == "proposal"
    assert escalation[0].detail["escalations"] == ["tools"]
    assert escalation[0].tenant_id == TENANT


@pytest.mark.asyncio
async def test_granting_an_escalated_task_writes_an_approval_row() -> None:
    bus = TeamBus(
        registry=_Registry([_profile("EMP-CHILD", tools=("ont_object_query", "ont_merge_objects"))])
    )
    pending = await bus.spawn(_request(actor="u-1"))
    await bus.grant(pending.task_id)

    approvals = [r for r in bus.audit.records(tenant_id=TENANT) if r.action == AUDIT_APPROVAL]
    assert len(approvals) == 1, bus.audit.records(tenant_id=TENANT)
    assert approvals[0].task_id == pending.task_id
    assert approvals[0].outcome == "approved"


@pytest.mark.asyncio
async def test_run_level_approval_is_audited() -> None:
    """run 级闸门的确认同样落行（这是"谁批了这轮计划"的答案）。"""
    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _Runtime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    state = await service.start(tenant_id=TENANT, goal="分析本月异常订单", user_token="")
    await service.resume(tenant_id=TENANT, run_id=str(state["run_id"]), approved=True)

    approvals = [r for r in service.audit.records(tenant_id=TENANT) if r.action == AUDIT_APPROVAL]
    assert len(approvals) == 1, service.audit.records(tenant_id=TENANT)
    assert approvals[0].run_id == state["run_id"]
    assert approvals[0].outcome == "approved"


@pytest.mark.asyncio
async def test_rejecting_is_audited_as_rejected() -> None:
    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _Runtime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    state = await service.start(tenant_id=TENANT, goal="分析本月异常订单", user_token="")
    await service.resume(tenant_id=TENANT, run_id=str(state["run_id"]), approved=False)

    approvals = [r for r in service.audit.records(tenant_id=TENANT) if r.action == AUDIT_APPROVAL]
    assert approvals[0].outcome == "rejected"


def test_audit_rows_are_tenant_scoped() -> None:
    log = AuditLog()
    log.append(
        action=AUDIT_SPAWN,
        tenant_id="tenant-a",
        actor="u-1",
        task_id="t1",
        run_id="r1",
        profile_id="EMP-X",
        outcome="granted",
    )
    assert len(log.records(tenant_id="tenant-a")) == 1
    assert log.records(tenant_id="tenant-b") == []


def test_audit_record_carries_a_stable_id_and_timestamp() -> None:
    log = AuditLog()
    record = log.append(
        action=AUDIT_SPAWN,
        tenant_id="tenant-a",
        actor="u-1",
        task_id="t1",
        run_id="r1",
        profile_id="EMP-X",
        outcome="granted",
    )
    assert record.audit_id
    assert record.at
    assert log.records(tenant_id="tenant-a", run_id="r1")[0].audit_id == record.audit_id


# ── HTTP：审计行读得出来（"落了吗"要能看见）────────────────────────────


def test_run_audit_endpoint_returns_rows(client: TestClient, auth_headers: dict[str, str]) -> None:
    run = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers
    ).json()
    client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=auth_headers
    )

    response = client.get(f"{BASE}/runs/{run['run_id']}/audit", headers=auth_headers)
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    # 该 run 的每一行都在（派活 + 审批），且都带租户与 run 归属。
    assert all(i["tenant_id"] == TENANT for i in items)
    assert AUDIT_APPROVAL in [i["action"] for i in items]
    approval = [i for i in items if i["action"] == AUDIT_APPROVAL][0]
    assert approval["run_id"] == run["run_id"]
    assert approval["outcome"] == "approved"


def test_run_audit_is_tenant_scoped(
    client: TestClient, auth_headers: dict[str, str], other_tenant_headers: dict[str, str]
) -> None:
    run = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers
    ).json()
    assert (
        client.get(f"{BASE}/runs/{run['run_id']}/audit", headers=other_tenant_headers).status_code
        == 404
    )


def test_run_audit_requires_authentication(client: TestClient) -> None:
    assert client.get(f"{BASE}/runs/whatever/audit").status_code == 401
