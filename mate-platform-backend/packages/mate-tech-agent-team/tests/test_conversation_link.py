"""C-1 / `MP-SESSION-RUN-LINK-01` 的判据：会话 ↔ run 的关系落在**后端**。

三件事分开验，因为失败模式不同：

1. **关系面本身**（内存 + PG）—— 关联、去重、按会话列、租户隔离。
2. **受理路径真的落了关系** —— ``POST /runs`` 带 ``conversation_id`` 时，
   回执里那个 ``run_id`` **一定**能从 ``GET /runs?conversation=`` 查到。这是
   本批最容易做错的地方：下面几条去重路径都会提前 return，关联要是放在它们
   之后，"重复提交"那条路上的关系就丢了。
3. **唯一关系源** —— 换个"浏览器"（没有 localStorage）也查得到：判据用的就是
   那个只认后端的读路径，全程不碰任何前端状态。
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.conversation_link import (
    RELATION_INITIATED,
    InMemoryConversationRuns,
    PgConversationRuns,
)
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"

TENANT = "tenant-conv"
CONV = "conv-abc"
RUN = "run-conv-1"


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
def client() -> Iterator[TestClient]:
    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _Runtime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    with TestClient(create_app(service=service)) as client:
        yield client


# ── 1. 关系面：内存 ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_link_then_read_back_by_conversation_and_by_run() -> None:
    links = InMemoryConversationRuns()
    await links.link(
        tenant_id=TENANT, conversation_id=CONV, run_id=RUN, turn_id="t1", created_by="u-1"
    )
    rows = await links.by_conversation(TENANT, CONV)
    assert [r.run_id for r in rows] == [RUN]
    assert rows[0].turn_id == "t1" and rows[0].created_by == "u-1"
    assert rows[0].relation_type == RELATION_INITIATED

    back = await links.by_run(TENANT, RUN)
    assert back is not None and back.conversation_id == CONV


@pytest.mark.asyncio
async def test_relinking_the_same_run_does_not_move_its_created_at() -> None:
    """重复关联是**幂等**的，且**不改** ``created_at``。

    刷新它会让"这一轮什么时候进这个会话"随重复提交漂移，历史顺序就不稳了
    ——这正是"覆盖写"在本项目里一贯被拒的理由（见 C-4 同一条原则）。
    """
    links = InMemoryConversationRuns()
    first = await links.link(tenant_id=TENANT, conversation_id=CONV, run_id=RUN)
    await asyncio.sleep(0.01)
    again = await links.link(tenant_id=TENANT, conversation_id=CONV, run_id=RUN, turn_id="t9")
    assert again.created_at == first.created_at
    assert again.turn_id == ""  # 也不改 turn_id：先到的那条说了算
    assert len(await links.by_conversation(TENANT, CONV)) == 1


@pytest.mark.asyncio
async def test_many_runs_keep_their_order() -> None:
    links = InMemoryConversationRuns()
    for index in range(5):
        await links.link(tenant_id=TENANT, conversation_id=CONV, run_id=f"run-{index}")
    rows = await links.by_conversation(TENANT, CONV)
    assert [r.run_id for r in rows] == [f"run-{i}" for i in range(5)]


@pytest.mark.asyncio
async def test_memory_links_are_tenant_scoped() -> None:
    links = InMemoryConversationRuns()
    await links.link(tenant_id=TENANT, conversation_id=CONV, run_id=RUN)
    assert await links.by_conversation("tenant-other", CONV) == []
    assert await links.by_run("tenant-other", RUN) is None


# ── 2. 关系面：PG（真库）───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pg_round_trip_and_idempotent_relink(app_dsn: str, rls_schema: str) -> None:
    links = PgConversationRuns(app_dsn, schema=rls_schema)
    await links.link(tenant_id=TENANT, conversation_id=CONV, run_id=RUN, turn_id="t1")
    await links.link(tenant_id=TENANT, conversation_id=CONV, run_id=RUN, turn_id="t2")

    rows = await links.by_conversation(TENANT, CONV)
    assert [r.run_id for r in rows] == [RUN], "重复关联不该攒出第二条"
    assert rows[0].turn_id == "t1", "先到的那条说了算（DO NOTHING）"
    back = await links.by_run(TENANT, RUN)
    assert back is not None and back.conversation_id == CONV


@pytest.mark.asyncio
async def test_pg_links_are_tenant_scoped(app_dsn: str, rls_schema: str) -> None:
    """硬规则 3：拿别的租户的 conversation_id 来查，**一行都读不到**。"""
    links = PgConversationRuns(app_dsn, schema=rls_schema)
    await links.link(tenant_id=TENANT, conversation_id=CONV, run_id=RUN)
    other = PgConversationRuns(app_dsn, schema=rls_schema)
    assert await other.by_conversation("tenant-other", CONV) == []
    assert await other.by_run("tenant-other", RUN) is None
    # 同一个 (conversation_id, run_id) 在别的租户里是**另一个命名空间**：它写得进去
    # （那是它自己的行），但两边互不可见。
    await other.link(tenant_id="tenant-other", conversation_id=CONV, run_id=RUN)
    assert len(await other.by_conversation("tenant-other", CONV)) == 1
    assert len(await links.by_conversation(TENANT, CONV)) == 1


# ── 3. HTTP：受理路径真的落了关系 ───────────────────────────────────────


def _accept(
    client: TestClient, headers: dict[str, str], *, goal: str, conversation: str = ""
) -> str:
    body: dict[str, Any] = {"goal": goal}
    if conversation:
        body["conversation_id"] = conversation
    response = client.post(f"{BASE}/runs", json=body, headers=headers)
    assert response.status_code == 202, response.text
    return str(response.json()["run_id"])


def test_a_run_started_in_a_conversation_is_listed_by_the_backend(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """① 换机器 / 清浏览器 → 仍看得到历史轮次的 run。

    判据刻意**不碰任何前端状态**：发一次带会话的提交，再只用后端那个读路径去
    找它。前端那份 localStorage 在这条用例里根本不存在。
    """
    run_id = _accept(client, auth_headers, goal="分析本月异常订单", conversation=CONV)

    listed = client.get(f"{BASE}/runs", params={"conversation": CONV}, headers=auth_headers)
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["conversation_id"] == CONV
    assert [item["run_id"] for item in body["items"]] == [run_id]
    item = body["items"][0]
    assert item["relation_type"] == RELATION_INITIATED
    assert item["created_at"], "关系要有落库时刻"
    assert item["created_by"] == "u-1", "created_by 取自令牌（sub），不是请求体"
    assert item["status"], "该轮此刻的状态一并回（与 GET /runs/{id} 同一份事实）"


def test_a_second_turn_in_the_same_conversation_shows_up_newest_first(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    first = _accept(client, auth_headers, goal="第一轮", conversation=CONV)
    time.sleep(0.01)
    second = _accept(client, auth_headers, goal="第二轮", conversation=CONV)

    items = client.get(f"{BASE}/runs", params={"conversation": CONV}, headers=auth_headers).json()[
        "items"
    ]
    assert [item["run_id"] for item in items] == [second, first]


def test_a_run_without_a_conversation_is_not_linked_anywhere(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """不起关系的一轮（工作台直接起、脚本、压测）不该出现在任何会话里。"""
    _accept(client, auth_headers, goal="没有会话的一轮")
    listed = client.get(f"{BASE}/runs", params={"conversation": CONV}, headers=auth_headers)
    assert listed.json()["items"] == []


def test_repeated_idempotent_submit_still_lands_in_the_conversation(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """**最容易做错的那条路**：带 ``Idempotency-Key`` 的重复提交会提前 return
    （``deduplicated``），关联要是写在它之后，这条路上就没有关系了。
    """
    headers = {**auth_headers, "Idempotency-Key": "conv-idem-1"}
    first = client.post(
        f"{BASE}/runs",
        json={"goal": "幂等提交", "conversation_id": CONV},
        headers=headers,
    ).json()
    again = client.post(
        f"{BASE}/runs",
        json={"goal": "幂等提交", "conversation_id": CONV},
        headers=headers,
    ).json()
    assert again["deduplicated"] is True
    assert again["run_id"] == first["run_id"]

    items = client.get(f"{BASE}/runs", params={"conversation": CONV}, headers=auth_headers).json()[
        "items"
    ]
    assert [item["run_id"] for item in items] == [first["run_id"]], "只该有一条关系"


def test_listing_a_conversation_is_tenant_scoped(
    client: TestClient, auth_headers: dict[str, str], other_tenant_headers: dict[str, str]
) -> None:
    """硬规则 3：别的租户拿同一个 conversation_id 来查，读到的是**空**。

    空而不是 404 是刻意的：会话 id 是租户内的地址，回 404 等于告诉对方
    "这个 id 在别处存在过"。
    """
    run_id = _accept(client, auth_headers, goal="本租户的一轮", conversation=CONV)
    listed = client.get(f"{BASE}/runs", params={"conversation": CONV}, headers=other_tenant_headers)
    assert listed.status_code == 200
    assert listed.json()["items"] == []
    # 而本租户仍看得见（不是"被别的租户查过就没了"）
    mine = client.get(f"{BASE}/runs", params={"conversation": CONV}, headers=auth_headers).json()
    assert [item["run_id"] for item in mine["items"]] == [run_id]


def test_listing_requires_the_conversation_parameter(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """没有 ``conversation`` 就不该有"列全租户 run"这条读路径。"""
    assert client.get(f"{BASE}/runs", headers=auth_headers).status_code == 422
    assert (
        client.get(f"{BASE}/runs", params={"conversation": ""}, headers=auth_headers).status_code
        == 422
    )


def test_listing_requires_authentication(client: TestClient) -> None:
    assert client.get(f"{BASE}/runs", params={"conversation": CONV}).status_code == 401


# ── 4. 控制面：状态仍然只有一份 ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_runs_in_conversation_hydrates_status_from_the_run_itself() -> None:
    """列表里的 ``status`` 走的是 :meth:`RunControl.refresh` 那条路。

    "列表与详情各说各话"是这一批最想避免的失败模式，所以这里断言的是**同源**：
    列表里那一项的状态与单独读那一轮拿到的状态逐个字符相等。
    """
    from mate_tech_agent_team.api.run_control import RunControl

    service = BrainService(
        planner_for=lambda _ctx: StaticPlanner(),
        runtime_for=lambda _ctx: _Runtime(),
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    control = RunControl(service)
    accepted = await control.submit(
        tenant_id=TENANT, goal="查状态来源", conversation_id=CONV, turn_id="t1"
    )
    run_id = accepted["run_id"]

    rows = await control.runs_in_conversation(tenant_id=TENANT, conversation_id=CONV)
    assert [r["run_id"] for r in rows] == [run_id]
    assert rows[0]["turn_id"] == "t1"

    settled = rows[0]["status"]
    deadline = time.monotonic() + 5.0
    while (
        settled not in {"awaiting_approval", "completed", "failed"} and time.monotonic() < deadline
    ):
        await asyncio.sleep(0.02)
        rows = await control.runs_in_conversation(tenant_id=TENANT, conversation_id=CONV)
        settled = rows[0]["status"]
    assert settled == (await control.refresh(tenant_id=TENANT, run_id=run_id))["status"]
    assert rows[0]["goal"] == "查状态来源"
