"""评测客户端与 CLI 的守卫（MP-EVAL-GOLDEN-01 / C-6）。

客户端全部用**注入的假传输**跑——不碰网络，但走的是与生产逐字相同的编排。
本文件要钉死两件事：

1. 探活失败（服务空名册 / 登录拿不到令牌 / HTTP 错）必须抛
   :class:`ProviderUnavailable`，让 runner **整轮退出**；
2. CLI 的三条退出码分工：0 正常、2 provider 不可达（并留一份未运行记录）、
   3 检出假回执（报告标 ``valid=false``）。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from mate_tech_agent_team.eval.client import AgentTeamClient, ProviderUnavailable
from mate_tech_agent_team.eval.run_golden import (
    EXIT_FAKE_RECEIPT,
    EXIT_INCOMPLETE,
    EXIT_OK,
    EXIT_PROVIDER_UNAVAILABLE,
    main,
)


class FakeGateway:
    """一个按 (method, path) 路由的假网关。"""

    def __init__(self, routes: dict[tuple[str, str], tuple[int, dict[str, Any]]]) -> None:
        self.routes = routes
        self.calls: list[tuple[str, str]] = []

    def __call__(
        self, method: str, url: str, headers: dict[str, str], body: dict | None
    ) -> tuple[int, dict]:
        path = url.split("127.0.0.1:8100", 1)[-1] if "127.0.0.1:8100" in url else url
        self.calls.append((method, path))
        key = (method, path)
        if key not in self.routes:
            # 未登记的路由回 404，和真网关一致。
            return 404, {"detail": "not found"}
        return self.routes[key]


def _client(routes: dict[tuple[str, str], tuple[int, dict[str, Any]]]) -> AgentTeamClient:
    return AgentTeamClient(
        base_url="http://127.0.0.1:8100",
        username="admin",
        password="admin123",
        transport=FakeGateway(routes),
    )


_PROFILES = {
    "profiles": [
        {"profile_id": "EMP-ANALYST", "name": "数据分析师"},
        {"profile_id": "EMP-AUDITOR", "name": "合规核对员"},
    ]
}


def test_login_stores_the_token() -> None:
    client = _client({("POST", "/api/v1/iam/auth/login"): (200, {"accessToken": "tok-1"})})
    assert client.login() == "tok-1"
    assert client.token == "tok-1"


def test_login_without_token_raises() -> None:
    client = _client({("POST", "/api/v1/iam/auth/login"): (200, {"accessToken": ""})})
    with pytest.raises(ProviderUnavailable, match="accessToken"):
        client.login()


def test_http_error_becomes_provider_unavailable() -> None:
    client = _client({("GET", "/api/v1/agent-team/profiles"): (500, {"detail": "boom"})})
    with pytest.raises(ProviderUnavailable, match="HTTP 500"):
        client.probe()


def test_probe_rejects_an_empty_roster() -> None:
    """服务在、名册空 = 没接上员工，评测没有意义 → 必须抛。"""
    client = _client({("GET", "/api/v1/agent-team/profiles"): (200, {"profiles": []})})
    with pytest.raises(ProviderUnavailable, match="空名册"):
        client.probe()


def test_probe_accepts_a_populated_roster() -> None:
    client = _client({("GET", "/api/v1/agent-team/profiles"): (200, _PROFILES)})
    assert client.probe()["profiles"][0]["profile_id"] == "EMP-ANALYST"


def test_usage_snapshot_is_none_when_the_gateway_has_no_route() -> None:
    """成本是可选指标：取不到就 None，**不**把整轮打死。"""
    client = _client({})
    assert client.usage_snapshot("tenant-default") is None


def _poll_routes() -> dict[tuple[str, str], tuple[int, dict[str, Any]]]:
    return {
        ("POST", "/api/v1/agent-team/runs"): (202, {"run_id": "r-9", "status": "running"}),
        (
            "GET",
            "/api/v1/agent-team/runs/r-9",
        ): (
            200,
            {
                "run_id": "r-9",
                "status": "awaiting_approval",
                "subtasks": [{"task_id": "t1", "profile_id": "EMP-ANALYST"}],
                "results": {"t1": {"task_id": "t1", "profile_id": "EMP-ANALYST", "status": "ok"}},
            },
        ),
        (
            "POST",
            "/api/v1/agent-team/runs/r-9/approve",
        ): (
            200,
            {
                "run_id": "r-9",
                "status": "completed",
                "subtasks": [{"task_id": "t1", "profile_id": "EMP-ANALYST"}],
                "results": {"t1": {"task_id": "t1", "profile_id": "EMP-ANALYST", "status": "ok"}},
            },
        ),
    }


def test_run_task_polls_then_approves() -> None:
    client = _client(_poll_routes())
    timed = client.run_task(goal="查订单", max_parallel=3, poll_interval=0, timeout_seconds=5)
    assert timed.raw["status"] == "completed"
    assert timed.observed_statuses == ("awaiting_approval",)
    assert timed.first_response_seconds >= 0
    assert ("POST", "/api/v1/agent-team/runs/r-9/approve") in client.transport.calls  # type: ignore[attr-defined]


def test_run_task_tolerates_transient_poll_errors() -> None:
    """网关偶发 502（agent-team 那一瞬连不上）不该把整轮评测打成堆栈。"""
    routes = _poll_routes()
    inner = FakeGateway(routes)
    polls = {"n": 0}

    def flaky(
        method: str, url: str, headers: dict[str, str], body: dict | None
    ) -> tuple[int, dict]:
        if method == "GET" and "/runs/r-9" in url:
            polls["n"] += 1
            if polls["n"] <= 2:
                return 502, {"code": "E502_UPSTREAM"}
        return inner(method, url, headers, body)

    client = AgentTeamClient(
        base_url="http://127.0.0.1:8100",
        username="admin",
        password="admin123",
        transport=flaky,
    )
    timed = client.run_task(
        goal="查订单", max_parallel=3, poll_interval=0, timeout_seconds=5, max_poll_errors=3
    )
    assert timed.raw["status"] == "completed"
    assert polls["n"] >= 3


# ── CLI 退出码 ──────────────────────────────────────────────────────────


def _run_state_with(results: dict[str, Any]) -> dict[str, Any]:
    return {
        "run_id": "r-1",
        "status": "awaiting_approval",
        "subtasks": [
            {"task_id": "t1", "profile_id": "EMP-ANALYST", "instruction": "查订单对象的字段"},
            {"task_id": "t2", "profile_id": "EMP-AUDITOR", "instruction": "核对订单字段口径"},
        ],
        "results": results,
        "summary": "",
    }


def _happy_routes(results: dict[str, Any]) -> dict[tuple[str, str], tuple[int, dict[str, Any]]]:
    return {
        ("POST", "/api/v1/iam/auth/login"): (200, {"accessToken": "tok"}),
        ("GET", "/api/v1/agent-team/profiles"): (200, _PROFILES),
        ("GET", "/api/v1/llmgw/usage/tenant-default"): (
            200,
            {"tenant_id": "tenant-default", "total_tokens": 100, "total_cost": 0.1},
        ),
        ("POST", "/api/v1/agent-team/runs"): (202, {"run_id": "r-1", "status": "running"}),
        ("GET", "/api/v1/agent-team/runs/r-1"): (200, _run_state_with(results)),
        (
            "POST",
            "/api/v1/agent-team/runs/r-1/approve",
        ): (200, {**_run_state_with(results), "status": "completed"}),
    }


_REAL_RESULTS = {
    "t1": {
        "task_id": "t1",
        "profile_id": "EMP-ANALYST",
        "status": "ok",
        "output": "订单对象 ont.tenant-default.obj.crm.order.v1 共 3 条",
        "source": "llm",
        "llm_calls": 2,
        "tool_calls": [{"name": "ont_list_classes"}, {"name": "ont_inspect_class"}],
        "evidence": [{"ref": "ont.tenant-default.obj.crm.order.v1"}],
    },
    "t2": {
        "task_id": "t2",
        "profile_id": "EMP-AUDITOR",
        "status": "ok",
        "output": "订单对象的字段口径一致",
        "source": "llm",
        "llm_calls": 2,
        "tool_calls": [{"name": "ont_object_query"}],
        "evidence": [{"ref": "ont.tenant-default.obj.crm.order.v1"}],
    },
}


def test_cli_returns_ok_and_writes_a_valid_report(tmp_path: Path) -> None:
    out = tmp_path / "report.json"

    def factory(*, base_url: str, username: str, password: str) -> AgentTeamClient:
        return _client(_happy_routes(_REAL_RESULTS))

    code = main(
        ["--task", "G-ONT-01", "--out", str(out), "--quiet", "--poll-interval", "0"],
        client_factory=factory,
    )
    assert code == EXIT_OK
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["valid"] is True
    assert payload["fake_receipts"] == []
    assert payload["dataset"]["version"] == "golden/v1"
    metric_names = {m["name"] for m in payload["metrics"]}
    assert "token_cost" in metric_names
    assert payload["per_task"]["G-ONT-01"]["run_id"] == "r-1"


def test_cli_fails_loudly_on_a_stub_echo(tmp_path: Path) -> None:
    """回显绝不能算成好答案：检出即退 3，且报告标 valid=false。"""
    out = tmp_path / "report.json"
    echoed = dict(_REAL_RESULTS)
    echoed["t1"] = {
        **_REAL_RESULTS["t1"],
        "output": "[stub-fallback] 你是数据分析师… Echo: 查订单",
    }

    def factory(*, base_url: str, username: str, password: str) -> AgentTeamClient:
        return _client(_happy_routes(echoed))

    code = main(
        ["--task", "G-ONT-01", "--out", str(out), "--quiet", "--poll-interval", "0"],
        client_factory=factory,
    )
    assert code == EXIT_FAKE_RECEIPT
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["valid"] is False
    assert len(payload["fake_receipts"]) == 1
    assert "stub-fallback" in payload["fake_receipts"][0]


def test_cli_returns_provider_unavailable_and_records_why(tmp_path: Path) -> None:
    """provider 不可达：退 2，并落一份"没跑成因为 X"的记录，不产出任何数字。"""
    out = tmp_path / "report.json"

    def factory(*, base_url: str, username: str, password: str) -> AgentTeamClient:
        # 登录路由缺失 → _call 得 404 → ProviderUnavailable
        return _client({})

    code = main(["--out", str(out), "--quiet"], client_factory=factory)
    assert code == EXIT_PROVIDER_UNAVAILABLE
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["valid"] is False
    assert "不可达" in payload["provider_error"]
    assert payload["metrics"] == []


def test_cli_keeps_going_and_records_a_task_level_outage(tmp_path: Path) -> None:
    """某个任务轮询期服务不可达：**继续跑其余任务并落报告**，退 4，不是甩堆栈。"""
    out = tmp_path / "report.json"
    routes = _happy_routes(_REAL_RESULTS)
    routes[("GET", "/api/v1/agent-team/runs/r-1")] = (502, {"code": "E502_UPSTREAM"})

    def factory(*, base_url: str, username: str, password: str) -> AgentTeamClient:
        return _client(routes)

    code = main(
        ["--task", "G-ONT-01", "--out", str(out), "--quiet", "--poll-interval", "0"],
        client_factory=factory,
    )
    assert code == EXIT_INCOMPLETE
    payload = json.loads(out.read_text(encoding="utf-8"))
    # 该任务没跑成 → 报告里没有它的 per_task；但报告本身仍然产出。
    assert "G-ONT-01" not in payload["per_task"]


def test_cli_rejects_an_unknown_task_id(tmp_path: Path) -> None:
    code = main(["--task", "NOPE", "--out", str(tmp_path / "r.json"), "--quiet"])
    assert code == EXIT_PROVIDER_UNAVAILABLE
