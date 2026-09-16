"""任务 1 · HTTP 面：一句话进、任务图/结果出、人工确认续跑。

只测路由与租户守门，不测模型真实性（那属于任务 2/3）。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from mate_tech_agent_team import (
    BrainService,
    InMemoryCheckpointerProvider,
    StaticPlanner,
    SubTaskResult,
)
from mate_tech_agent_team.main import create_app

BASE = "/api/v1/agent-team"


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
    )
    return TestClient(create_app(service=service))


def test_healthz_is_anonymous(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_runs_require_authentication(client: TestClient) -> None:
    assert client.post(f"{BASE}/runs", json={"goal": "分析订单"}).status_code == 401


def test_start_run_returns_task_graph(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "awaiting_approval"
    assert len(body["subtasks"]) == 3
    assert len(body["results"]) == 3
    assert body["tenant_id"] == "tenant-acme"


def test_get_run_and_approve_completes(client: TestClient, auth_headers: dict[str, str]) -> None:
    run = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers
    ).json()

    fetched = client.get(f"{BASE}/runs/{run['run_id']}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["status"] == "awaiting_approval"
    assert fetched.json()["hitl_reason"]

    approved = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=auth_headers
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "completed"
    assert "tenant-acme" in approved.json()["summary"]


def test_cross_tenant_run_is_not_found(
    client: TestClient, auth_headers: dict[str, str], other_tenant_headers: dict[str, str]
) -> None:
    run = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers
    ).json()

    assert client.get(f"{BASE}/runs/{run['run_id']}", headers=auth_headers).status_code == 200
    assert (
        client.get(f"{BASE}/runs/{run['run_id']}", headers=other_tenant_headers).status_code == 404
    )
    assert (
        client.post(
            f"{BASE}/runs/{run['run_id']}/approve",
            json={"approved": True},
            headers=other_tenant_headers,
        ).status_code
        == 404
    )


def test_approve_twice_is_conflict(client: TestClient, auth_headers: dict[str, str]) -> None:
    run = client.post(
        f"{BASE}/runs", json={"goal": "分析本月异常订单"}, headers=auth_headers
    ).json()
    first = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=auth_headers
    )
    assert first.status_code == 200
    second = client.post(
        f"{BASE}/runs/{run['run_id']}/approve", json={"approved": True}, headers=auth_headers
    )
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "E_RUN_NOT_AWAITING_APPROVAL"
