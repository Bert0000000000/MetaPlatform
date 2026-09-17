"""轨 2 · 外部运行时（Claude Code）的验收用例（ADR-0066 §5.8 / S6）。

判据：

1. **真的是下投影**：员工的身份（提示词 + skill 引用 + 工具面）被渲染进一个
   **按租户隔离的临时工作区**，并以系统提示 + 工具白名单的形式交给 CLI——
   不是"拿一个黑箱 CLI 敲一句话把回显抄回来"（D-10）。
2. **回执如实**：`source` / `llm_calls` 是这条链的凭据；跑失败了就说失败，
   绝不编造产出。
3. **租户隔离**（硬规则 #3）：员工按 `(tenant, profile_id)` 取，工作区按租户分目录。
4. **CLI 缺失/失败**不许静默成功。

测试用的 CLI 是 `tmp_path` 里现生成的**确定性桩脚本**（`cli_stub.py`），它把收到的
argv 落进工作区，于是"投影真的到了命令行"这件事可断言。另有一条**对着本机真
`claude`** 跑、且**不 skip** 的用例（ADR-0015 规则 7 不许 skip）：它不假设 CLI
一定可用，只断言"无论成不成，回执都如实"。
"""

from __future__ import annotations

import inspect
import json
import pathlib
import sys
import textwrap
from typing import Any

import pytest
from mate_tech_agent_team.profiles import EmployeeProfile, ProfileRegistry, RuntimeKind
from mate_tech_agent_team.runtimes import (
    ClaudeCodeProjection,
    ClaudeCodeRuntime,
    scan_for_secrets,
)
from mate_tech_agent_team.state import SubTask
from mate_tech_agent_team.team_bus import TaskTerminal, TeamBus
from mate_tech_agent_team.team_task_store import InMemoryTeamTasks

# ── 桩 CLI：确定性地把"收到的命令行"落进工作区，再回一份合法 JSON ─────────

_STUB = textwrap.dedent(
    """
    import json, os, sys

    argv = sys.argv[1:]

    def after(flag):
        return argv[argv.index(flag) + 1] if flag in argv else ""

    prompt = after("-p")
    dump = {
        "argv": argv,
        "prompt": prompt,
        "system": after("--system-prompt"),
        "tools": after("--allowedTools"),
        "model": after("--model"),
        "cwd": os.getcwd(),
    }
    with open("_stub_argv.json", "w", encoding="utf-8") as fh:
        json.dump(dump, fh, ensure_ascii=False)

    if "BOOM" in prompt:
        # 模型侧失败：CLI 以非零码退出，并把 is_error 标出来
        print(json.dumps({"type": "result", "is_error": True, "num_turns": 1,
                          "result": "上游模型报错"}, ensure_ascii=False))
        sys.exit(1)

    print(json.dumps({
        "type": "result",
        "is_error": False,
        "num_turns": 3,
        "session_id": "stub-session",
        "result": "[stub] 已处理：" + prompt,
    }, ensure_ascii=False))
    """
).strip()


@pytest.fixture
def stub_cli(tmp_path: pathlib.Path) -> list[str]:
    script = tmp_path / "cli_stub.py"
    script.write_text(_STUB, encoding="utf-8")
    return [sys.executable, str(script)]


# ── 替身：租户作用域的员工库 ─────────────────────────────────────────────


class TenantScopedProfileStore:
    """按 `(tenant_id, profile_id)` 索引的名册替身（= ProfileStore 的语义）。"""

    def __init__(self, rows: dict[tuple[str, str], EmployeeProfile]) -> None:
        self._rows = dict(rows)

    async def get(self, tenant_id: str, profile_id: str) -> EmployeeProfile | None:
        return self._rows.get((tenant_id, profile_id))

    async def list(self, tenant_id: str) -> list[EmployeeProfile]:
        return [p for (tenant, _), p in self._rows.items() if tenant == tenant_id]


_CLAUDE_PROFILE = EmployeeProfile(
    profile_id="EMP-CLAUDE",
    name="本体核对员",
    base_role="ontology",
    system_prompt="你是本体核对员。核对 rid 的写法，产出必须给出你查到的字段名。",
    skills=("sk-order-anomaly",),
    tools=("ont_list_classes", "ont_object_query"),
    model="glm-5.3-flash",
    runtimes=(RuntimeKind.SUPERAI, RuntimeKind.CLAUDE_CODE),
)


def _registry(rows: dict[tuple[str, str], EmployeeProfile] | None = None) -> ProfileRegistry:
    store = TenantScopedProfileStore(
        rows if rows is not None else {("tenant-acme", "EMP-CLAUDE"): _CLAUDE_PROFILE}
    )
    return ProfileRegistry([], store=store)


class _Skill:
    def __init__(self, skill_id: str, name: str, description: str, content: str) -> None:
        self.id = skill_id
        self.name = name
        self.description = description
        self.content = content


class FakeSkillStore:
    def __init__(self, skills: list[_Skill]) -> None:
        self._by_id = {s.id: s for s in skills}

    def get(self, skill_id: str) -> _Skill | None:
        return self._by_id.get(skill_id)


def _projection() -> ClaudeCodeProjection:
    """带技能目录的投影：清单要进指令正文（只出引用，不出正文）。"""
    from mate_tech_agent_team.skills import SkillCatalog

    catalog = SkillCatalog(
        FakeSkillStore(
            [
                _Skill(
                    "sk-order-anomaly",
                    "异常订单识别",
                    "识别异常订单的口径与阈值",
                    "正文：阈值 = 3σ，逐仓比对……" * 40,
                )
            ]
        )
    )
    return ClaudeCodeProjection(skills=catalog)


def _runtime(cli: list[str], tmp_path: pathlib.Path, **kwargs: Any) -> ClaudeCodeRuntime:
    return ClaudeCodeRuntime(
        registry=kwargs.pop("registry", _registry()),
        projection=kwargs.pop("projection", _projection()),
        cli_command=cli,
        working_root=tmp_path / "runtimes",
        **kwargs,
    )


def _subtask(instruction: str = "核对本月异常订单的 rid 写法") -> SubTask:
    return SubTask(
        task_id="t1",
        team_task_id="run-abc12345-t1",
        profile_id="EMP-CLAUDE",
        instruction=instruction,
        depends_on=[],
    )


def _stub_dump(tmp_path: pathlib.Path, task_id: str, tenant_id: str) -> dict[str, Any]:
    path = tmp_path / "runtimes" / tenant_id / task_id / "_stub_argv.json"
    return json.loads(path.read_text(encoding="utf-8"))


# ── 判据 1：下投影真的到了命令行 ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_runtime_is_structurally_an_employee_runtime() -> None:
    """结构上满足 `EmployeeRuntime` 协议（`run(*, subtask, tenant_id)`，异步）。"""
    assert inspect.iscoroutinefunction(ClaudeCodeRuntime.run)
    params = inspect.signature(ClaudeCodeRuntime.run).parameters
    assert {"subtask", "tenant_id"} <= set(params)


@pytest.mark.asyncio
async def test_the_projection_really_reaches_the_cli(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    runtime = _runtime(stub_cli, tmp_path)
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")

    assert result["status"] == "ok", result
    # 回执如实：产出不等于指令、模型确实被调用过
    assert result["source"] == "llm"
    assert result["llm_calls"] == 3  # 取 CLI 回的 num_turns
    assert result["output"].startswith("[stub] 已处理：")
    assert result["output"] != _subtask()["instruction"]

    dump = _stub_dump(tmp_path, "run-abc12345-t1", "tenant-acme")
    # ① 员工的身份提示词进了系统提示（不是通用模板）
    assert "本体核对员" in dump["system"]
    # ② 工具面以白名单形式下放
    assert dump["tools"] == "ont_list_classes,ont_object_query"
    # ③ 工作区就是那个按任务开的临时目录（cwd 证据）
    assert dump["cwd"] == str(tmp_path / "runtimes" / "tenant-acme" / "run-abc12345-t1")


@pytest.mark.asyncio
async def test_projection_is_materialised_into_a_tenant_scoped_workspace(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    runtime = _runtime(stub_cli, tmp_path)
    await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")

    workspace = tmp_path / "runtimes" / "tenant-acme" / "run-abc12345-t1"
    claude_md = (workspace / "CLAUDE.md").read_text(encoding="utf-8")
    manifest = json.loads((workspace / "projection.json").read_text(encoding="utf-8"))

    assert "本体核对员" in claude_md
    assert "sk-order-anomaly" in claude_md  # 清单只出引用，不出正文
    assert "ont_object_query" in claude_md
    assert manifest["runtimeKind"] == "claude_code"
    assert manifest["tools"] == ["ont_list_classes", "ont_object_query"]
    # 硬规则 #12：落盘的下放产物不含任何密钥样material
    payload = claude_md + json.dumps(manifest, ensure_ascii=False)
    assert scan_for_secrets(payload) == []


@pytest.mark.asyncio
async def test_only_the_granted_tool_face_is_projected(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    """派活闸门发下来的工具面（`granted_tools`）就是下放的那一份——只能收窄。"""
    subtask = _subtask()
    subtask["granted_tools"] = ["ont_object_query"]
    runtime = _runtime(stub_cli, tmp_path)
    await runtime.run(subtask=subtask, tenant_id="tenant-acme")

    dump = _stub_dump(tmp_path, "run-abc12345-t1", "tenant-acme")
    assert dump["tools"] == "ont_object_query"
    manifest = json.loads(
        (tmp_path / "runtimes" / "tenant-acme" / "run-abc12345-t1" / "projection.json").read_text(
            encoding="utf-8"
        )
    )
    assert manifest["tools"] == ["ont_object_query"]


# ── 判据 2：失败如实，绝不编造 ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_failing_cli_is_a_truthful_error_receipt(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    runtime = _runtime(stub_cli, tmp_path)
    result = await runtime.run(subtask=_subtask("BOOM 这条必失败"), tenant_id="tenant-acme")

    assert result["status"] == "error"
    assert result["output"] == "", "失败不许编造产出"
    assert "退出码" in result["error"] or "1" in result["error"]
    # 模型确实跑过（CLI 起过了），但产出是空的——source/llm_calls 要如实
    assert result["llm_calls"] == 1


@pytest.mark.asyncio
async def test_a_missing_cli_is_reported_and_never_faked(tmp_path: pathlib.Path) -> None:
    runtime = _runtime([str(tmp_path / "no-such-binary")], tmp_path)
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")

    assert result["status"] == "error"
    assert result["output"] == ""
    assert result["llm_calls"] == 0, "CLI 没起来 = 一次模型调用都没发生"
    assert result["source"] == "stub", "没跑成模型就不许标成 llm 产出"


@pytest.mark.asyncio
async def test_unknown_profile_is_an_error_receipt(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    subtask = _subtask()
    subtask["profile_id"] = "EMP-NOPE"
    result = await _runtime(stub_cli, tmp_path).run(subtask=subtask, tenant_id="tenant-acme")
    assert result["status"] == "error"
    assert "员工不存在" in result["error"]


# ── 判据 3：租户隔离（硬规则 #3）────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_profile_of_another_tenant_is_not_visible(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    """跨租户 negative：只在 acme 名册里的员工，other 租户取不到、也跑不了。"""
    runtime = _runtime(stub_cli, tmp_path)
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-other")

    assert result["status"] == "error"
    assert "员工不存在" in result["error"]
    # 而且**没有**在 other 租户下开出任何工作区（读不到就不该有副作用）
    assert not (tmp_path / "runtimes" / "tenant-other").exists()


@pytest.mark.asyncio
async def test_workspaces_are_isolated_per_tenant(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    """同一个 task_id 在不同租户下是**两个**工作区，互不覆盖。"""
    runtime = _runtime(
        stub_cli,
        tmp_path,
        registry=_registry(
            {
                ("tenant-acme", "EMP-CLAUDE"): _CLAUDE_PROFILE,
                ("tenant-other", "EMP-CLAUDE"): _CLAUDE_PROFILE,
            }
        ),
    )
    await runtime.run(subtask=_subtask("acme 的活"), tenant_id="tenant-acme")
    await runtime.run(subtask=_subtask("other 的活"), tenant_id="tenant-other")

    acme = _stub_dump(tmp_path, "run-abc12345-t1", "tenant-acme")
    other = _stub_dump(tmp_path, "run-abc12345-t1", "tenant-other")
    assert "acme 的活" in acme["prompt"] and "other 的活" not in acme["prompt"]
    assert "other 的活" in other["prompt"] and "acme 的活" not in other["prompt"]


# ── 实例层通道：跑完置终态，之后的 send 必须 409（不假装还能追问）────────


@pytest.mark.asyncio
async def test_finished_external_task_refuses_follow_up_messages(
    stub_cli: list[str], tmp_path: pathlib.Path
) -> None:
    """外部 runtime **不能**在运行中消费 inbox（进程外的 CLI 收不到投递）。

    诚实做法是：开跑登记、跑完置终态；此后的 ``send`` 一律 409——
    而不是让一次投递静静地落进虚空，让人以为"追问过了"。
    """
    bus = TeamBus(registry=_registry(), tasks=InMemoryTeamTasks())
    runtime = _runtime(stub_cli, tmp_path, channel=bus)
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-acme")
    assert result["status"] == "ok"

    task = await bus.task(task_id="run-abc12345-t1", tenant_id="tenant-acme")
    assert task is not None and task.status == "completed"
    with pytest.raises(TaskTerminal):
        await bus.send(task_id="run-abc12345-t1", tenant_id="tenant-acme", message="再补一个口径")


# ── 真 CLI：不 skip，断言"无论成不成，回执都如实" ────────────────────────


@pytest.mark.asyncio
async def test_the_real_cli_receipt_is_truthful_whatever_it_returns(tmp_path: pathlib.Path) -> None:
    """对着**本机真的** ``claude`` CLI 跑一次，只断言回执如实。

    刻意**不 skip**（ADR-0015 规则 7：跑不了的用例要么修前置、要么删掉）。这条
    不需要"本机 CLI 一定登录着"这个前置——它断言的是一个**任何机器上都成立**的
    性质，而不是一次具体的环境结果：

    * CLI 跑成了 → 有非空产出、``source="llm"``（真调到了模型）；
    * CLI 没跑成（没装 / 没登录）→ ``status="error"`` 且**产出为空**——
      绝不把一段编出来的话当成模型产出（D-10 要治的"假回执"）。

    可变的是环境，不可变的是"回执必须说实话"。这条同时是**真 SDK/子进程面**的
    冒烟：桩用例验的是"投影有没有到命令行"，它验的是"命令行到没到得通"。
    """
    from mate_tech_agent_team.runtimes import default_cli_command

    runtime = _runtime(default_cli_command() or [], tmp_path)
    result = await runtime.run(
        subtask=_subtask("用一句话回答：1+1 等于几？只回数字。"),
        tenant_id="tenant-acme",
    )
    if result["status"] == "ok":
        assert result["source"] == "llm", result
        assert result["output"].strip(), "CLI 说成功了却没有产出"
        assert result["llm_calls"] >= 1, result
    else:
        assert result["status"] == "error", result
        assert result["output"].strip() == "", f"报错了却带着产出——那是伪造：{result}"
        assert result["error"], "报错了却没给错因"
