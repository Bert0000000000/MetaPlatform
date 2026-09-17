"""任务 1 · HTTP 面：一句话进、任务图/结果出、人工确认续跑。

只测路由与租户守门，不测模型真实性（那属于任务 2/3）。
"""

from __future__ import annotations

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
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"

#: run 停下来的状态：闸门（等人）或任何终态。
_SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})


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
    # **必须用 `with` 进 TestClient**：不带上下文时 Starlette 每个请求现起一个事件
    # 循环、请求完就关，而 1.7 起 ``POST /runs`` 是受理制（图在后台跑）——后台
    # 任务会在响应返回的瞬间被拆掉，run 永远停在 running。
    with TestClient(create_app(service=service)) as client:
        yield client


def _accept(client: TestClient, headers: dict[str, str], goal: str = "分析本月异常订单") -> str:
    """受理一轮运行，回 ``run_id``（1.7：``202`` + run_id）。"""
    response = client.post(f"{BASE}/runs", json={"goal": goal}, headers=headers)
    assert response.status_code == 202, response.text
    return str(response.json()["run_id"])


def _settle(client: TestClient, run_id: str, headers: dict[str, str]) -> dict[str, Any]:
    """轮询到 run 停下来（闸门或终态）为止——受理制下"提交"与"有结果"是两件事。"""
    deadline = time.monotonic() + 8.0
    body: dict[str, Any] = {}
    while time.monotonic() < deadline:
        body = client.get(f"{BASE}/runs/{run_id}", headers=headers).json()
        if body.get("status") in _SETTLED:
            return body
        time.sleep(0.02)
    return body


def test_healthz_is_anonymous(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_runs_require_authentication(client: TestClient) -> None:
    assert client.post(f"{BASE}/runs", json={"goal": "分析订单"}).status_code == 401


def test_start_run_is_accepted_then_settles_into_a_task_graph(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """受理回执只有地址；**任务图要再查一次**（1.7 受理制）。"""
    accepted = client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers)
    assert accepted.status_code == 202, accepted.text
    receipt = accepted.json()
    assert receipt["run_id"]
    assert receipt["tenant_id"] == "tenant-acme"
    assert receipt["deduplicated"] is False
    assert "subtasks" not in receipt, "受理回执不该带运行结果"

    body = _settle(client, receipt["run_id"], auth_headers)
    assert body["status"] == "awaiting_approval"
    assert len(body["subtasks"]) == 3
    assert len(body["results"]) == 3
    assert body["tenant_id"] == "tenant-acme"


def test_get_run_and_approve_completes(client: TestClient, auth_headers: dict[str, str]) -> None:
    run_id = _accept(client, auth_headers)
    body = _settle(client, run_id, auth_headers)
    assert body["status"] == "awaiting_approval"
    assert body["hitl_reason"]

    approved = client.post(
        f"{BASE}/runs/{run_id}/approve", json={"approved": True}, headers=auth_headers
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "completed"
    assert "tenant-acme" in approved.json()["summary"]


def test_cross_tenant_run_is_not_found(
    client: TestClient, auth_headers: dict[str, str], other_tenant_headers: dict[str, str]
) -> None:
    run_id = _accept(client, auth_headers)
    _settle(client, run_id, auth_headers)

    assert client.get(f"{BASE}/runs/{run_id}", headers=auth_headers).status_code == 200
    assert client.get(f"{BASE}/runs/{run_id}", headers=other_tenant_headers).status_code == 404
    assert (
        client.post(
            f"{BASE}/runs/{run_id}/approve",
            json={"approved": True},
            headers=other_tenant_headers,
        ).status_code
        == 404
    )


def test_approve_twice_is_conflict(client: TestClient, auth_headers: dict[str, str]) -> None:
    run_id = _accept(client, auth_headers)
    _settle(client, run_id, auth_headers)
    first = client.post(
        f"{BASE}/runs/{run_id}/approve", json={"approved": True}, headers=auth_headers
    )
    assert first.status_code == 200
    second = client.post(
        f"{BASE}/runs/{run_id}/approve", json={"approved": True}, headers=auth_headers
    )
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "E_RUN_NOT_AWAITING_APPROVAL"
