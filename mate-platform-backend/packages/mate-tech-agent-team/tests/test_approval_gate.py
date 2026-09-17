"""B-6 / `MP-APPROVAL-GATE-ABI-01` 的判据：闸门协议、多级、会签、超时。

三段：

1. **协议本身**（:func:`evaluate_gate` / :func:`record_decision`）—— 纯函数，
   不起图、不碰 PG。三种能力（多级 / 会签 / 超时）的语义全在这里被打。
2. **协议能被别人消费** —— ``to_dict`` / ``from_dict`` 往返一致；``gate_id`` 稳定，
   审批中心拿它当主键。
3. **接进真图** —— 到闸门时 run 的状态里**带得走**这份协议；默认形态与旧语义
   （单布尔）**逐字等价**；配成会签之后，一个人批不动。

判据里点名"至少支持多级审批 / 会签 / 超时中的两项"——这里三项都有用例。
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import ExitStack
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.approval_gate import (
    ANY_ROLE,
    APPROVED,
    EXPIRED,
    GATE_PLAN,
    PENDING,
    REJECTED,
    ApprovalGate,
    evaluate_gate,
    new_gate_id,
    record_decision,
)
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"
_JWT_SECRET = "test-secret"


def _gate(**overrides: Any) -> ApprovalGate:
    base: dict[str, Any] = {
        "gate_id": "run-1:plan_gate",
        "run_id": "run-1",
        "tenant_id": TENANT,
        "gate_type": GATE_PLAN,
        "created_at": 0.0,
    }
    return ApprovalGate(**{**base, **overrides})


# ── 1. 协议本身 ─────────────────────────────────────────────────────────


def test_default_gate_needs_exactly_one_approval() -> None:
    """缺省形态 = **单级、任意审批角色、一个人同意即可**（与 B-6 之前的布尔等价）。"""
    gate = _gate()
    assert evaluate_gate(gate, now=0.0).state == PENDING

    once = record_decision(gate, actor="u-1", roles=["agent_admin"], now=1.0)
    outcome = evaluate_gate(once, now=1.0)
    assert outcome.state == APPROVED
    assert outcome.approvers == ("u-1",)


def test_consign_requires_distinct_approvers() -> None:
    """**会签**：``required_approvals=2`` 时要**两个不同的人**。

    同一个人批两次**不算两票**——这是会签与"刷两下"的分界。
    """
    gate = _gate(required_approvals=2)

    first = record_decision(gate, actor="u-1", roles=["agent_admin"], now=1.0)
    outcome = evaluate_gate(first, now=1.0)
    assert outcome.state == PENDING
    assert (outcome.approvals_at_level, outcome.required_approvals) == (1, 2)
    assert "还差 1 个同意" in outcome.reason

    # 同一个人再批一次：仍然只有一票。
    repeat = record_decision(first, actor="u-1", roles=["agent_admin"], now=2.0)
    assert evaluate_gate(repeat, now=2.0).state == PENDING

    second = record_decision(repeat, actor="u-2", roles=["agent_admin"], now=3.0)
    outcome = evaluate_gate(second, now=3.0)
    assert outcome.state == APPROVED
    assert sorted(outcome.approvers) == ["u-1", "u-2"]


def test_multi_level_approval_needs_every_level_in_order() -> None:
    """**多级审批**：``required_roles`` 有序，逐级凑；差哪一级就报哪一级。"""
    gate = _gate(required_roles=("agent_admin", "platform_admin"))

    l1 = record_decision(gate, actor="u-1", roles=["agent_admin"], now=1.0)
    outcome = evaluate_gate(l1, now=1.0)
    assert outcome.state == PENDING
    assert (outcome.level_index, outcome.level_role) == (1, "platform_admin"), (
        "第一级满足了，应该卡在第二级"
    )

    # 拿别的角色批不动（归不到任何一级 → 不属于 platform_admin 那一级）
    wrong = record_decision(l1, actor="u-2", roles=["agent_admin"], now=2.0)
    assert evaluate_gate(wrong, now=2.0).state == PENDING

    l2 = record_decision(l1, actor="u-2", roles=["platform_admin"], now=3.0)
    outcome = evaluate_gate(l2, now=3.0)
    assert outcome.state == APPROVED
    assert sorted(outcome.approvers) == ["u-1", "u-2"]


def test_any_role_level_accepts_any_holder() -> None:
    """``ANY_ROLE`` 那一级收所有人（缺省闸门就是它）。"""
    gate = _gate(required_roles=(ANY_ROLE,), required_approvals=1)
    decision = record_decision(gate, actor="u-9", roles=["whatever"], now=1.0)
    assert evaluate_gate(decision, now=1.0).state == APPROVED


def test_a_single_rejection_is_final_and_not_outvoted() -> None:
    """**驳回是终局**：一个明确的否不该被后面的同意冲淡（会签也一样）。"""
    gate = _gate(required_approvals=3)
    rejected = record_decision(
        gate, actor="u-1", roles=["agent_admin"], approved=False, comment="预算不对", now=1.0
    )
    later = record_decision(rejected, actor="u-2", roles=["agent_admin"], now=2.0)
    later = record_decision(later, actor="u-3", roles=["agent_admin"], now=3.0)

    outcome = evaluate_gate(later, now=3.0)
    assert outcome.state == REJECTED
    assert "预算不对" in outcome.reason


def test_expiry_turns_a_still_pending_gate_into_expired() -> None:
    """**超时**：到点还是 ``pending`` → ``expired``（调用方据此落终态）。"""
    gate = _gate(required_approvals=2, expires_at=100.0)
    one = record_decision(gate, actor="u-1", roles=["agent_admin"], now=1.0)

    assert evaluate_gate(one, now=50.0).state == PENDING
    expired = evaluate_gate(one, now=101.0)
    assert expired.state == EXPIRED
    assert "已过期" in expired.reason


def test_an_approved_gate_stays_approved_past_its_expiry() -> None:
    """已经批完的闸门**不会**因为过了时刻倒回 ``expired``——超时只吃掉没完成的。"""
    gate = _gate(expires_at=100.0)
    done = record_decision(gate, actor="u-1", roles=["agent_admin"], now=1.0)
    assert evaluate_gate(done, now=10_000.0).state == APPROVED


def test_a_decision_never_claims_a_role_the_approver_does_not_hold() -> None:
    """归级用**令牌里签出来的**角色：对不上就记空串，绝不冒充。"""
    gate = _gate(required_roles=("platform_admin",))
    decided = record_decision(gate, actor="u-1", roles=["agent_admin"], now=1.0)
    assert decided.decisions[0].role == ""
    assert evaluate_gate(decided, now=1.0).state == PENDING


def test_the_later_decision_from_the_same_actor_wins() -> None:
    """同一个人改主意：**后一次覆盖前一次**（不是攒成两条）。"""
    gate = _gate(required_approvals=2)
    yes = record_decision(gate, actor="u-1", roles=[], approved=True, now=1.0)
    no = record_decision(yes, actor="u-1", roles=[], approved=False, now=2.0)
    assert len(no.decisions) == 1
    assert no.decisions[0].decision == REJECTED


# ── 2. 协议能被别人消费 ─────────────────────────────────────────────────


def test_the_gate_round_trips_through_its_wire_shape() -> None:
    """``to_dict`` / ``from_dict`` 往返一致 —— 审批中心读的就是这个形状。"""
    gate = _gate(
        required_roles=("agent_admin", "platform_admin"),
        required_approvals=2,
        payload={"goal": "分析本月异常订单"},
        editable_fields=("summary",),
        expires_at=123.0,
    )
    decided = record_decision(gate, actor="u-1", roles=["agent_admin"], comment="同意", now=7.0)
    restored = ApprovalGate.from_dict(decided.to_dict())
    assert restored == decided
    assert restored is not None
    assert evaluate_gate(restored, now=8.0).to_dict() == evaluate_gate(decided, now=8.0).to_dict()


def test_an_old_checkpoint_without_a_gate_reads_as_absent() -> None:
    """**老检查点没有这个键是正常的**：读出来是 ``None``，调用方退回单布尔语义。"""
    assert ApprovalGate.from_dict(None) is None
    assert ApprovalGate.from_dict({}) is None


def test_the_gate_id_is_a_stable_address() -> None:
    """同 run 同类型 → 同一个 ``gate_id``：审批中心拿它当主键，不会批出第二个闸门。"""
    assert new_gate_id(run_id="run-1") == new_gate_id(run_id="run-1")
    assert new_gate_id(run_id="run-1") != new_gate_id(run_id="run-2")


# ── 3. 接进真图 ─────────────────────────────────────────────────────────


class _Runtime:
    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


def _token(*, actor: str) -> str:
    import jwt as pyjwt

    now = int(time.time())
    claims = {
        "sub": actor,
        "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend",
        "azp": "metaplatform-backend",
        "preferred_username": actor,
        "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
        "roles": ["PLATFORM_SUPER_ADMIN"],
        "tenant_id": TENANT,
        "iat": now,
        "exp": now + 3600,
    }
    return pyjwt.encode(claims, _JWT_SECRET, algorithm="HS256")


def _headers(actor: str = "u-1") -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(actor=actor)}"}


_clients: ExitStack = ExitStack()


@pytest.fixture(autouse=True)
def _close_test_clients() -> Iterator[None]:
    yield
    _clients.close()


def _app() -> TestClient:
    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _Runtime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    return _clients.enter_context(TestClient(_create_app(service)))


def _create_app(service: BrainService) -> FastAPI:
    return create_app(service=service)


def _wait_status(client: TestClient, run_id: str, expected: str, timeout: float = 5.0) -> str:
    deadline = time.monotonic() + timeout
    status = ""
    while time.monotonic() < deadline:
        status = client.get(f"{BASE}/runs/{run_id}", headers=_headers()).json()["status"]
        if status == expected:
            return status
        time.sleep(0.02)
    return status


def test_the_run_state_carries_the_gate_protocol() -> None:
    """到闸门时，run 的状态里**带得走**这份协议（审批中心据此列待办）。"""
    client = _app()
    run = client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=_headers()).json()
    assert _wait_status(client, run["run_id"], "awaiting_approval") == "awaiting_approval"

    body = client.get(f"{BASE}/runs/{run['run_id']}", headers=_headers()).json()
    gate = body["approval_gate"]
    assert gate["gate_id"] == f"{run['run_id']}:plan_gate"
    assert gate["gate_type"] == GATE_PLAN
    assert gate["required_approvals"] == 1
    assert gate["decisions"] == []
    assert gate["payload"]["goal"] == "分析本月异常订单"


def test_a_default_gate_still_resumes_on_one_approval() -> None:
    """默认形态与旧行为**逐字等价**：一次同意就续跑完。"""
    client = _app()
    run = client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=_headers()).json()
    assert _wait_status(client, run["run_id"], "awaiting_approval") == "awaiting_approval"

    approved = client.post(
        f"{BASE}/runs/{run['run_id']}/approve",
        json={"approved": True, "comment": "同意"},
        headers=_headers(),
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "completed"
    assert approved.json()["approval_gate"]["decisions"][0]["comment"] == "同意"


def test_a_consign_gate_needs_a_second_distinct_approver(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """**会签接进真图**：``required_approvals=2`` 时一个人批不动，第二个人才推得动。

    这条是"协议不是死代码"的证明：部署策略一改，闸门的行为就跟着变，
    **不需要改图**。
    """
    monkeypatch.setenv("MATE_AGENT_TEAM_GATE_REQUIRED_APPROVALS", "2")
    client = _app()
    run = client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=_headers()).json()
    assert _wait_status(client, run["run_id"], "awaiting_approval") == "awaiting_approval"

    first = client.post(
        f"{BASE}/runs/{run['run_id']}/approve",
        json={"approved": True, "comment": "我先看"},
        headers=_headers("u-1"),
    )
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "awaiting_approval", "一个人就把它推下去了"
    assert first.json()["approval_gate"]["decisions"][0]["actor"] == "u-1"

    second = client.post(
        f"{BASE}/runs/{run['run_id']}/approve",
        json={"approved": True, "comment": "我也同意"},
        headers=_headers("u-2"),
    )
    assert second.status_code == 200, second.text
    assert second.json()["status"] == "completed"
    assert {d["actor"] for d in second.json()["approval_gate"]["decisions"]} == {"u-1", "u-2"}


def test_a_rejection_through_the_api_fails_the_run() -> None:
    """驳回终局：闸门落 ``rejected``，这一轮判失败（与旧语义一致）。"""
    client = _app()
    run = client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=_headers()).json()
    assert _wait_status(client, run["run_id"], "awaiting_approval") == "awaiting_approval"

    rejected = client.post(
        f"{BASE}/runs/{run['run_id']}/approve",
        json={"approved": False, "comment": "预算不对"},
        headers=_headers(),
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "failed"
    decision = rejected.json()["approval_gate"]["decisions"][0]
    assert (decision["decision"], decision["comment"]) == ("rejected", "预算不对")
