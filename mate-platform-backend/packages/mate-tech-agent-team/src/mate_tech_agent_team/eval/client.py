"""真实 agent-team 服务的评测客户端（MP-EVAL-GOLDEN-01 / C-6）。

**为什么走 HTTP 而不是在进程内拼一个 BrainService**：评测要测的是"真实
provider 上模型能不能稳定完成企业任务"，那就必须走生产同一条链——网关
→ agent-team → llmgw → 上游模型 → MCP 工具面 → 本体。在进程内另起一套装配，
测的是"我这次拼的这一套"，不是"部署的那一套"。

**为什么用标准库 urllib 而不是 httpx**：硬规则 #4（``forbid_bare_httpx``）扫的是
``.../src/*.py``；本模块就在那个范围内，而它只是评测 harness 的出站口，没必
要也不该为它开白名单。``urllib.request`` 够用，且 ``S310`` 已在 ruff 配置里
豁免（"受控场景"）。

**失败要响**：:meth:`AgentTeamClient.probe` 探不到服务 / 探不到员工名册时抛
:class:`ProviderUnavailable`——runner 据此**整轮退出**，绝不在一个空服务上跑出
一堆"0 分"然后当成基线。
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

Json = dict[str, Any]

#: 注入点：``(method, url, headers, body) -> (status, json)``。测试用它喂假传输，
#: 生产用 :func:`_urllib_transport`。默认参数化是为了让用例不必碰网络。
Transport = Callable[[str, str, dict[str, str], Json | None], "tuple[int, Json]"]


class ProviderUnavailable(RuntimeError):
    """真实服务 / 真实 provider 不可达——**不该**继续跑出一堆假分数。"""


class RunTimedOut(RuntimeError):
    """一次 run 在预算内没到终态。"""


def _urllib_transport(
    method: str, url: str, headers: dict[str, str], body: Json | None
) -> tuple[int, Json]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read().decode("utf-8") or "{}"
            return response.status, json.loads(payload)
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8") or "{}"
        try:
            parsed = json.loads(payload)
        except ValueError:
            parsed = {"detail": payload}
        return exc.code, parsed
    except urllib.error.URLError as exc:
        raise ProviderUnavailable(f"连不上 {url}：{exc.reason}") from exc


def roster_items(payload: Json) -> list[Any]:
    """名册条目的容器键：契约回 ``profiles``，部分旧读法用 ``items``，两个都认。"""
    for key in ("profiles", "items"):
        value = payload.get(key) if isinstance(payload, dict) else None
        if isinstance(value, list):
            return value
    return []


@dataclass(slots=True)
class TimedRun:
    """一次 run 的观测结果（原始回执 + 轮询时看到的状态序列 + 时间）。"""

    raw: Json
    observed_statuses: tuple[str, ...]
    first_response_seconds: float
    total_seconds: float


@dataclass(slots=True)
class AgentTeamClient:
    """agent-team 的评测面：登录 → 探活 → 起 run → 轮询 → 审批。"""

    base_url: str
    username: str
    password: str
    transport: Transport = _urllib_transport
    token: str = ""
    last_status: int = 0
    extra: dict[str, Any] = field(default_factory=dict)

    # -- 基础设施 ---------------------------------------------------------

    def _call(self, method: str, path: str, body: Json | None = None) -> Json:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        status, payload = self.transport(method, f"{self.base_url}{path}", headers, body)
        self.last_status = status
        if status >= 400:
            raise ProviderUnavailable(f"{method} {path} -> HTTP {status}: {str(payload)[:300]}")
        return payload

    def login(self) -> str:
        """经网关换一枚用户 JWT。**必须拿真令牌**：服务身份 token 的 iss 与网关
        不一致会被 llmgw 判 401（env-facts §3），评测要的是链根真实。"""
        payload = self._call(
            "POST",
            "/api/v1/iam/auth/login",
            {"username": self.username, "password": self.password},
        )
        token = str(payload.get("accessToken") or "")
        if not token:
            raise ProviderUnavailable(f"登录未返回 accessToken：{str(payload)[:200]}")
        self.token = token
        return token

    def probe(self) -> Json:
        """探活：能列出员工名册才算"真实服务在"。空名册 = provider 没接好。"""
        profiles = self._call("GET", "/api/v1/agent-team/profiles")
        items = roster_items(profiles)
        if not items:
            raise ProviderUnavailable(
                "agent-team /profiles 返回空名册——服务在但没接上员工，评测没有意义"
            )
        return profiles

    def usage_snapshot(self, tenant_id: str) -> Json | None:
        """llmgw 的租户用量快照；取不到返回 ``None``（**不**抛——成本是可选指标）。"""
        try:
            payload = self._call("GET", f"/api/v1/llmgw/usage/{tenant_id}")
        except ProviderUnavailable:
            return None
        if not isinstance(payload, dict) or "total_tokens" not in payload:
            return None
        return payload

    # -- 跑一轮 -----------------------------------------------------------

    def start_run(self, *, goal: str, max_parallel: int) -> str:
        accepted = self._call(
            "POST",
            "/api/v1/agent-team/runs",
            {"goal": goal, "max_parallel": max_parallel},
        )
        run_id = str(accepted.get("run_id") or "")
        if not run_id:
            raise ProviderUnavailable(f"POST /runs 未返回 run_id：{str(accepted)[:200]}")
        return run_id

    def get_run(self, run_id: str) -> Json:
        return self._call("GET", f"/api/v1/agent-team/runs/{run_id}")

    def approve(self, run_id: str, *, comment: str) -> Json:
        return self._call(
            "POST",
            f"/api/v1/agent-team/runs/{run_id}/approve",
            {"approved": True, "comment": comment},
        )

    def run_task(
        self,
        *,
        goal: str,
        max_parallel: int,
        poll_interval: float = 5.0,
        timeout_seconds: float = 300.0,
        max_poll_errors: int = 5,
        on_poll: Callable[[float], None] | None = None,
    ) -> TimedRun:
        """起一轮、轮询到「停在闸门」或终态、审批、回收终态。

        首响应 = 从 POST 返回到**首次观察到 subtasks 非空**的秒数——用户感知的
        "它开始动了"就是这一刻。总时长 = 到审批后终态。

        ``max_poll_errors`` 是**轮询期的容错**：网关偶发 502（agent-team 那一瞬
        连不上）不该把整轮评测打成一堆堆栈。连续错这么多次、或超出墙钟预算，
        才如实往上抛。
        """
        started = time.monotonic()
        run_id = self.start_run(goal=goal, max_parallel=max_parallel)
        observed: list[str] = []
        first_response = 0.0
        final: Json = {}
        poll_errors = 0
        deadline = started + timeout_seconds
        while True:
            try:
                state = self.get_run(run_id)
            except ProviderUnavailable:
                poll_errors += 1
                if poll_errors > max_poll_errors or time.monotonic() > deadline:
                    raise
                time.sleep(poll_interval)
                continue
            poll_errors = 0
            status = str(state.get("status") or "")
            if status and (not observed or observed[-1] != status):
                observed.append(status)
            if first_response == 0.0 and (state.get("subtasks") or []):
                first_response = time.monotonic() - started
            if status == "awaiting_approval":
                if on_poll is not None:
                    on_poll(time.monotonic() - started)
                final = self.approve(run_id, comment="golden eval")
                break
            if status in {"completed", "failed", "rejected", "cancelled", "timeout"}:
                final = state
                break
            if time.monotonic() > deadline:
                raise RunTimedOut(
                    f"run {run_id} 在 {timeout_seconds}s 内未到终态（最后状态 {status!r}）"
                )
            if on_poll is not None:
                on_poll(time.monotonic() - started)
            time.sleep(poll_interval)
        total = time.monotonic() - started
        # 终态有时在 approve 的回执里直接给全；拿不到就再读一次。
        if not final.get("results"):
            final = self.get_run(run_id)
        if first_response == 0.0:
            first_response = total
        return TimedRun(
            raw=final,
            observed_statuses=tuple(observed),
            first_response_seconds=round(first_response, 3),
            total_seconds=round(total, 3),
        )


__all__ = [
    "AgentTeamClient",
    "ProviderUnavailable",
    "RunTimedOut",
    "TimedRun",
    "Transport",
    "roster_items",
]
