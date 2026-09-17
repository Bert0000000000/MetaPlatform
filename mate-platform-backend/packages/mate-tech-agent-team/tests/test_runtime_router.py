"""轨 2 · 执行面路由的验收用例（ADR-0066 §5.8：角色 × 运行时正交两轴）。

判据：

1. **按 profile 声明选执行面**——声明 ``runtimes=(CLAUDE_CODE,)`` 的员工必须由
   Claude Code 运行时跑，而不是"声明归声明、执行还是 superai"。
2. **不静默换地方跑**——声明的执行面一个都没装配时**如实报错**，不代跑。
3. **默认不动存量**——没配 ``MATE_AGENT_TEAM_RUNTIMES`` 的部署行为与从前逐字一致；
   ``enabled_runtime_kinds()`` 的默认值是空元组。
4. 库里存的是字符串（``"claude_code"``）也要认。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileRegistry, RuntimeKind
from mate_tech_agent_team.state import SubTask
from mate_tech_agent_team.wiring import (
    ROUTABLE_RUNTIMES,
    RuntimeRouter,
    enabled_runtime_kinds,
)

# ── 替身 ────────────────────────────────────────────────────────────────


class RecordingRuntime:
    """记录被谁调过、以什么租户调过；回一份 ok 回执。"""

    def __init__(self, name: str) -> None:
        self.name = name
        self.calls: list[tuple[str, str]] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> dict[str, Any]:
        self.calls.append((subtask.get("task_id", ""), tenant_id))
        return {
            "task_id": subtask.get("task_id", ""),
            "profile_id": subtask.get("profile_id", ""),
            "status": "ok",
            "output": f"由 {self.name} 执行",
            "source": "llm",
            "llm_calls": 1,
            "tool_calls": [],
            "evidence": [],
        }


def _profile(profile_id: str, runtimes: tuple[Any, ...] | None = None) -> EmployeeProfile:
    kwargs: dict[str, Any] = {}
    if runtimes is not None:
        kwargs["runtimes"] = runtimes
    return EmployeeProfile(
        profile_id=profile_id,
        name=profile_id,
        base_role="ontology",
        system_prompt="x",
        tools=("ont_object_query",),
        **kwargs,
    )


def _subtask(profile_id: str) -> SubTask:
    return SubTask(task_id="t1", profile_id=profile_id, instruction="干活", depends_on=[])


# ── 判据 3：默认不动存量 ────────────────────────────────────────────────


def test_router_is_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """没配 env = 不启用路由。存量部署拿到的还是 `LlmEmployeeRuntime`，一行没变。"""
    monkeypatch.delenv("MATE_AGENT_TEAM_RUNTIMES", raising=False)
    assert enabled_runtime_kinds() == ()


def test_enabled_runtime_kinds_parses_and_dedupes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_AGENT_TEAM_RUNTIMES", " claude_code , superai , claude_code ")
    assert enabled_runtime_kinds() == (RuntimeKind.CLAUDE_CODE, RuntimeKind.SUPERAI)


def test_an_unknown_runtime_name_is_loud_not_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    """写错名字要**启动失败**，不能当你没配——否则一个已下放外部的员工会悄悄跑回 superai。"""
    monkeypatch.setenv("MATE_AGENT_TEAM_RUNTIMES", "claude_code,dsh")
    with pytest.raises(RuntimeError) as excinfo:
        enabled_runtime_kinds()
    assert "dsh" in str(excinfo.value)
    assert "external_a2a" in str(excinfo.value), "报错要列出可选值"


def test_routable_names_match_the_runtime_kind_enum() -> None:
    assert set(ROUTABLE_RUNTIMES.values()) == {
        RuntimeKind.SUPERAI,
        RuntimeKind.CLAUDE_CODE,
        RuntimeKind.EXTERNAL_A2A,
    }


# ── 判据 1：按声明选执行面 ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_router_picks_the_runtime_the_profile_declares() -> None:
    superai = RecordingRuntime("superai")
    claude = RecordingRuntime("claude_code")
    router = RuntimeRouter(
        registry=ProfileRegistry([_profile("EMP-CLAUDE", (RuntimeKind.CLAUDE_CODE,))]),
        runtimes={RuntimeKind.SUPERAI: superai, RuntimeKind.CLAUDE_CODE: claude},
        default=superai,
    )
    result = await router.run(subtask=_subtask("EMP-CLAUDE"), tenant_id="tenant-acme")

    assert result["output"] == "由 claude_code 执行"
    assert claude.calls == [("t1", "tenant-acme")]
    assert superai.calls == []


@pytest.mark.asyncio
async def test_router_honours_declaration_order() -> None:
    """声明顺序就是优先级：先写的先选。"""
    first = RecordingRuntime("claude_code")
    second = RecordingRuntime("superai")
    router = RuntimeRouter(
        registry=ProfileRegistry(
            [_profile("EMP-X", (RuntimeKind.CLAUDE_CODE, RuntimeKind.SUPERAI))]
        ),
        runtimes={RuntimeKind.CLAUDE_CODE: first, RuntimeKind.SUPERAI: second},
        default=second,
    )
    await router.run(subtask=_subtask("EMP-X"), tenant_id="tenant-acme")
    assert first.calls and not second.calls


@pytest.mark.asyncio
async def test_a_profile_without_runtimes_uses_the_default_superai_path() -> None:
    """不传 `runtimes=` 的存量员工（库里全都没这一列）→ 走 superai。"""
    superai = RecordingRuntime("superai")
    router = RuntimeRouter(
        registry=ProfileRegistry([_profile("EMP-OLD")]),
        runtimes={RuntimeKind.SUPERAI: superai},
        default=superai,
    )
    result = await router.run(subtask=_subtask("EMP-OLD"), tenant_id="tenant-acme")
    assert result["output"] == "由 superai 执行"


@pytest.mark.asyncio
async def test_string_kinds_from_storage_are_recognised() -> None:
    """库里/JSON 存的是字符串 —— 认不出来会让"声明了却选不中"。"""
    claude = RecordingRuntime("claude_code")
    router = RuntimeRouter(
        registry=ProfileRegistry([_profile("EMP-C", ("claude_code",))]),
        runtimes={RuntimeKind.CLAUDE_CODE: claude},
        default=RecordingRuntime("superai"),
    )
    result = await router.run(subtask=_subtask("EMP-C"), tenant_id="tenant-acme")
    assert result["output"] == "由 claude_code 执行"


# ── 判据 2：不静默换地方跑 ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_unwired_runtime_is_reported_not_substituted() -> None:
    """声明了 claude_code 但本部署只装配了 superai → 报错，**不**拿 superai 代跑。"""
    superai = RecordingRuntime("superai")
    router = RuntimeRouter(
        registry=ProfileRegistry([_profile("EMP-CLAUDE", (RuntimeKind.CLAUDE_CODE,))]),
        runtimes={RuntimeKind.SUPERAI: superai},
        default=superai,
    )
    result = await router.run(subtask=_subtask("EMP-CLAUDE"), tenant_id="tenant-acme")

    assert result["status"] == "error"
    assert "claude_code" in result["error"]
    assert superai.calls == [], "竟然换了个执行面代跑"


@pytest.mark.asyncio
async def test_unknown_profile_is_reported_by_the_superai_receipt() -> None:
    """跨租户/不存在同码：措辞由 `default` 运行时给（与既有回执逐字一致）。"""
    superai = RecordingRuntime("superai")

    class _Missing:
        async def run(self, *, subtask: SubTask, tenant_id: str) -> dict[str, Any]:
            return {
                "status": "error",
                "error": f"员工不存在：{subtask['profile_id']}（租户 {tenant_id}）",
            }

    router = RuntimeRouter(
        registry=ProfileRegistry([_profile("EMP-OLD")]),
        runtimes={RuntimeKind.SUPERAI: superai},
        default=_Missing(),
    )
    result = await router.run(subtask=_subtask("EMP-NOPE"), tenant_id="tenant-other")
    assert result["status"] == "error"
    assert "员工不存在" in result["error"]
    assert superai.calls == []


def test_available_lists_what_is_actually_wired() -> None:
    router = RuntimeRouter(
        registry=ProfileRegistry([]),
        runtimes={RuntimeKind.SUPERAI: RecordingRuntime("superai")},
    )
    assert router.available == (RuntimeKind.SUPERAI,)
