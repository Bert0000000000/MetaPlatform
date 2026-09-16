"""1.3 轨 2 · 运行控制面：动态员工入口 + 取消 / 超时 + Run 事件流。

判据（来自 GOAL 轨 2）：

* 建员工 → 重启仍在（且跨租户不可见）
* 取消后落终态；超时后落终态（不是"挂着"）
* SSE 能收到步骤级事件
* 跨租户负例（员工 / run / 事件一律 404，不泄露存在性）

**为什么"落终态"要写进检查点而不是只记在内存**：run 的状态本来就在 langgraph
的检查点里（``GET /runs/{id}`` 读的就是它）。控制面另记一份就等于两个真相，
重启/多副本时立刻互相打脸。

**边界（诚实登记）**：取消作用于**停在闸门**的 run——那正是本产品真正会
"挂着"的形态（执行中的 run 有请求在等它，超时由运行级兜底）；事件流是
**回放**检查点里的步骤快照后收流，不做长连接尾随（见 1.4 候选）。
"""

from __future__ import annotations

import time
from typing import Any

import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    BrainService,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    ProfileStore,
    StaticPlanner,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.main import create_app
from mate_tech_agent_team.profile_store import bootstrap_profiles
from mate_tech_agent_team.profiles import EmployeeProfile

BASE = "/api/v1/agent-team"
TENANT = "tenant-acme"

_JWT_SECRET = "test-secret"


def _token(*, tenant_id: str = TENANT, permissions: list[str] | None = None) -> str:
    import jwt as pyjwt

    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": "u-1",
        "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend",
        "azp": "metaplatform-backend",
        "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
        "roles": ["PLATFORM_SUPER_ADMIN"],
        "tenant_id": tenant_id,
        "iat": now,
        "exp": now + 3600,
    }
    if permissions is not None:
        claims["permissions"] = permissions
    return pyjwt.encode(claims, _JWT_SECRET, algorithm="HS256")


def _headers(tenant_id: str = TENANT, permissions: list[str] | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(tenant_id=tenant_id, permissions=permissions)}"}


class _Runtime:
    async def run(self, *, subtask, tenant_id: str) -> SubTaskResult:
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _MemoryStore:
    """内存版落库面（**测试替身**）。

    生产只有 PG 一条路（``wiring.build_profile_store`` 缺 DSN 直接启动失败，
    没有静默回落）。不需要真库的用例用它，需要验证"落库 + RLS"的用例注入真的
    ``ProfileStore``。
    """

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], EmployeeProfile] = {}

    async def upsert(self, tenant_id: str, profile: EmployeeProfile) -> EmployeeProfile:
        if not tenant_id:
            raise ValueError("tenant_id is required")
        self._rows[(tenant_id, profile.profile_id)] = profile
        return profile

    async def get(self, tenant_id: str, profile_id: str) -> EmployeeProfile | None:
        return self._rows.get((tenant_id, profile_id))

    async def list(self, tenant_id: str) -> list[EmployeeProfile]:
        return [p for (tenant, _), p in self._rows.items() if tenant == tenant_id]

    async def delete(self, tenant_id: str, profile_id: str) -> bool:
        return self._rows.pop((tenant_id, profile_id), None) is not None


def _service(
    *,
    store: Any = None,
    bus: TeamBus | None = None,
    checkpointer: Any = None,
) -> tuple[BrainService, TeamBus, Any]:
    store = store if store is not None else _MemoryStore()
    registry = ProfileRegistry(store=store)
    bus = bus if bus is not None else TeamBus(registry=registry, tasks=InMemoryTeamTasks())
    checkpointer = checkpointer if checkpointer is not None else InMemoryCheckpointerProvider()
    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _Runtime(),
        checkpointer=checkpointer,
        team_bus=bus,
    )
    return service, bus, store


def _app(
    *,
    store: Any = None,
    bus: TeamBus | None = None,
    checkpointer: Any = None,
) -> TestClient:
    service, bus, store = _service(store=store, bus=bus, checkpointer=checkpointer)
    return TestClient(
        create_app(
            service=service,
            team_bus=bus,
            profile_store=store,
            profile_registry=ProfileRegistry(store=store),
        )
    )


# ── 动态员工入口 ────────────────────────────────────────────────────────


def test_create_profile_returns_it_in_the_roster() -> None:
    client = _app()
    created = client.post(
        f"{BASE}/profiles",
        json={
            "name": "订单分析师",
            "base_role": "ontology",
            "system_prompt": "你是订单分析师。",
            "tools": ["ont_object_query"],
            "skills": ["sk-order-anomaly"],
        },
        headers=_headers(),
    )
    assert created.status_code == 201, created.text
    profile_id = created.json()["profile_id"]
    assert profile_id

    listed = client.get(f"{BASE}/profiles", headers=_headers()).json()["profiles"]
    assert profile_id in [p["profile_id"] for p in listed]

    one = client.get(f"{BASE}/profiles/{profile_id}", headers=_headers())
    assert one.status_code == 200
    assert one.json()["tools"] == ["ont_object_query"]


def test_put_updates_an_existing_profile() -> None:
    client = _app()
    created = client.post(
        f"{BASE}/profiles",
        json={"profile_id": "EMP-CUSTOM", "name": "初版", "base_role": "ontology"},
        headers=_headers(),
    )
    assert created.status_code == 201, created.text

    updated = client.put(
        f"{BASE}/profiles/EMP-CUSTOM",
        json={
            "name": "二版",
            "base_role": "ontology",
            "system_prompt": "改过的提示词",
            "tools": ["ont_list_classes"],
        },
        headers=_headers(),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "二版"
    assert updated.json()["tools"] == ["ont_list_classes"]


def test_profile_creation_requires_auth() -> None:
    client = _app()
    assert (
        client.post(f"{BASE}/profiles", json={"name": "x", "base_role": "ontology"}).status_code
        == 401
    )


def test_creating_a_profile_beyond_the_creator_envelope_is_forbidden() -> None:
    """ADR-0066 §3.7：定义出来的包络必须 ⊆ 创建者包络，否则 403。

    发起用户是管理员（内置能力全集），``a2a_invoke`` 不在其中——定义出来就等于
    绕开包络闸门给员工塞了一个平台没发布的能力。
    """
    client = _app()
    response = client.post(
        f"{BASE}/profiles",
        json={
            "profile_id": "EMP-OVERREACH",
            "name": "越权员工",
            "base_role": "ontology",
            "tools": ["a2a_invoke"],
        },
        headers=_headers(),
    )
    assert response.status_code == 403, response.text
    assert "tools" in response.json()["detail"]["escalations"]

    # 令牌里显式授予该工具后即可定义
    allowed = client.post(
        f"{BASE}/profiles",
        json={
            "profile_id": "EMP-OVERREACH",
            "name": "越权员工",
            "base_role": "ontology",
            "tools": ["a2a_invoke"],
        },
        headers=_headers(permissions=["tool:a2a_invoke"]),
    )
    assert allowed.status_code == 201, allowed.text


# ── 取消 ────────────────────────────────────────────────────────────────


def _start_run(client: TestClient, **extra: Any) -> dict[str, Any]:
    response = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单", **extra}, headers=_headers()
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_cancel_moves_the_run_to_a_terminal_state() -> None:
    client = _app()
    run = _start_run(client)
    assert run["status"] == "awaiting_approval"

    cancelled = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    # 终态是**写进检查点**的：再查一次还是它，且不能再被确认续跑
    again = client.get(f"{BASE}/runs/{run['run_id']}", headers=_headers())
    assert again.json()["status"] == "cancelled"
    approve = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=_headers()
    )
    assert approve.status_code == 409


def test_cancel_is_idempotent() -> None:
    client = _app()
    run = _start_run(client)
    first = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())
    second = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "cancelled"


def test_cancel_from_another_tenant_is_not_found() -> None:
    client = _app()
    run = _start_run(client)
    response = client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers("tenant-other"))
    assert response.status_code == 404


# ── 超时 ────────────────────────────────────────────────────────────────


def test_run_times_out_into_a_terminal_state() -> None:
    client = _app()
    run = _start_run(client, timeout_seconds=0.05)

    deadline = time.monotonic() + 5
    status = ""
    while time.monotonic() < deadline:
        status = client.get(f"{BASE}/runs/{run['run_id']}", headers=_headers()).json()["status"]
        if status == "timeout":
            break
        time.sleep(0.02)

    assert status == "timeout", f"超时后仍停在 {status!r} —— 运行挂着不落终态"
    approve = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=_headers()
    )
    assert approve.status_code == 409


def test_a_run_within_its_deadline_is_left_alone() -> None:
    client = _app()
    run = _start_run(client, timeout_seconds=30)
    assert (
        client.get(f"{BASE}/runs/{run['run_id']}", headers=_headers()).json()["status"]
        == "awaiting_approval"
    )


# ── 事件流 ──────────────────────────────────────────────────────────────


def test_events_stream_carries_step_level_events() -> None:
    client = _app()
    run = _start_run(client)

    response = client.get(f"{BASE}/runs/{run['run_id']}/events", headers=_headers())
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")

    body = response.text
    assert "event: step" in body, body[:400]
    # 步骤级 = 每个节点产生的推进各一条（plan / dispatch / worker / gate …）
    for node in ("plan", "worker", "gate"):
        assert node in body, f"{node} 的推进没出现在事件流里：{body[:400]}"
    assert "event: end" in body


def test_events_from_another_tenant_are_not_found() -> None:
    client = _app()
    run = _start_run(client)
    response = client.get(f"{BASE}/runs/{run['run_id']}/events", headers=_headers("tenant-other"))
    assert response.status_code == 404


# ── 落库 + 跨租户（需要 PG）─────────────────────────────────────────────


@pytest.fixture
def profile_schema(pg_dsns: tuple[str, str]) -> Any:
    import psycopg

    admin_dsn, _ = pg_dsns
    schema = "agent_team_profile_test"
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
        # 少了这条，mate_app 连 schema 都看不见（报"表不存在"，不是"没权限"）
        conn.execute(f"GRANT USAGE ON SCHEMA {schema} TO mate_app")
        conn.execute(f"SET search_path TO {schema}")
        bootstrap_profiles(conn)
    yield schema
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")


def test_created_profile_survives_a_restart(profile_schema: str, pg_dsns: tuple[str, str]) -> None:
    """建出来的员工是**库里的行**：新进程/新副本读得到（1.1 落库的兑现）。"""
    _, app_dsn = pg_dsns
    created = _app(store=ProfileStore(app_dsn, schema=profile_schema)).post(
        f"{BASE}/profiles",
        json={"profile_id": "EMP-PERSIST", "name": "持久员工", "base_role": "ontology"},
        headers=_headers(),
    )
    assert created.status_code == 201, created.text

    # 模拟"重启"：全新一套对象读同一个 schema
    restarted = _app(store=ProfileStore(app_dsn, schema=profile_schema))
    listed = restarted.get(f"{BASE}/profiles", headers=_headers()).json()["profiles"]
    assert "EMP-PERSIST" in [p["profile_id"] for p in listed]


def test_created_profile_is_invisible_to_another_tenant(
    profile_schema: str, pg_dsns: tuple[str, str]
) -> None:
    """隔离由数据库 RLS 强制（``mate_app`` 非超级角色，不是"应用层记得过滤"）。"""
    _, app_dsn = pg_dsns
    client = _app(store=ProfileStore(app_dsn, schema=profile_schema))
    created = client.post(
        f"{BASE}/profiles",
        json={"profile_id": "EMP-PRIVATE", "name": "私密员工", "base_role": "ontology"},
        headers=_headers(),
    )
    assert created.status_code == 201, created.text

    other = client.get(f"{BASE}/profiles", headers=_headers("tenant-other"))
    assert "EMP-PRIVATE" not in [p["profile_id"] for p in other.json()["profiles"]]
    assert (
        client.get(f"{BASE}/profiles/EMP-PRIVATE", headers=_headers("tenant-other")).status_code
        == 404
    )
    # 也不能改别人的员工
    assert (
        client.put(
            f"{BASE}/profiles/EMP-PRIVATE",
            json={"name": "篡改", "base_role": "ontology"},
            headers=_headers("tenant-other"),
        ).status_code
        == 404
    )


@pytest.mark.asyncio
async def test_profile_store_round_trips_the_full_envelope(
    profile_schema: str, pg_dsns: tuple[str, str]
) -> None:
    """包络四维都要落库（缺一维 = 派活闸门少一个约束）。"""
    _, app_dsn = pg_dsns
    store = ProfileStore(app_dsn, schema=profile_schema)
    profile = EmployeeProfile(
        profile_id="EMP-ENV",
        name="包络员工",
        base_role="ontology",
        system_prompt="…",
        tools=("ont_object_query",),
        action_rids=("ont.create_link",),
        kb_ids=("kb-orders",),
        markings=("internal",),
    )
    await store.upsert(TENANT, profile)
    got = await store.get(TENANT, "EMP-ENV")
    assert got is not None
    assert got.envelope() == profile.envelope()


@pytest.mark.asyncio
async def test_cancel_is_visible_to_a_fresh_service_over_the_same_checkpointer() -> None:
    """终态写在**检查点**上，不是记在控制面内存里。

    换一个全新的服务实例（同一个检查点器）来读，读到的还是 ``cancelled``——
    这条成立才谈得上"重启后状态还在"。
    """
    checkpointer = InMemoryCheckpointerProvider()
    bus = TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks())
    client = _app(checkpointer=checkpointer, bus=bus)
    run = _start_run(client)
    client.post(f"{BASE}/runs/{run['run_id']}/cancel", headers=_headers())

    fresh, _, _ = _service(checkpointer=checkpointer, bus=bus)
    state = await fresh.get(tenant_id=TENANT, run_id=run["run_id"])
    assert state["status"] == "cancelled"
