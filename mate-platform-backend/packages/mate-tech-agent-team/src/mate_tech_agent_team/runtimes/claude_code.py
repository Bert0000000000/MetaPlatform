"""外部运行时：**Claude Code CLI**（ADR-0066 §5.8 的 ``RuntimeKind.CLAUDE_CODE``）。

**它不是"调一个外部 CLI 当黑箱"**——那样只是换了个地方发假回执。真正的语义是
先把员工的身份**下投影**成一个工作区里的产物（``CLAUDE.md`` + ``projection.json``），
再把这份投影作为**系统提示 + 工具白名单**交给 CLI 执行：

    profile ──render──▶ RuntimeBundle ──materialise──▶ <root>/<tenant>/<task>/
                                                            ├── CLAUDE.md
                                                            └── projection.json
                                                              │
    SubtaskResult ◀──parse── claude -p <instruction> --system-prompt <instructions>

**为什么选 Claude Code**：本机 `claude` CLI（v2.1.220）有非交互模式（`-p/--print`），
接受系统提示注入（`--system-prompt`）与工具允许表（`--allowedTools`），于是"角色 +
工具面"这两样**真的**下得去（skill 只下清单，见 projection 的边界登记）。

**执行面在进程外 ⇒ 有几件事做不到，如实登记**：

* **inbox 投递消费不了**：CLI 是子进程，"下一轮迭代边界取消息"没有落点。所以本
  运行时只**登记 + 收尾**（``TaskChannel``），跑完置终态；此后的 ``send`` 由
  ``TeamBus`` 判 409——而不是让一次投递静静落进虚空。
* **skill 正文拿不到**：``read_skill`` 的挂载面（MCP）没接，投影只出清单。
* **``model`` 不直接透传**：profile 的 ``model`` 是 llmgw 的模型名（glm-…），
  喂给 claude CLI 是错的。要不要 ``--model`` 由部署显式配
  （``MATE_AGENT_TEAM_CLAUDE_MODEL``），否则用 CLI 自己的默认。
* **工具名未必是 CLI 认识的工具**：投影下来的工具名来自 MCP 工具面，CLI 侧要真的
  能调需要把它们配成 MCP server（``--mcp-config``）——本切片没接。

* **子进程只拿到白名单环境**：**不再** ``{**os.environ, ...}`` —— 宿主进程里的
  DB DSN / Service Secret / Keycloak 配置一律不下放（:mod:`.sandbox_env`）。
  CLI 的登录态走它自己的凭据文件（``~/.claude``），不靠继承宿主 env。

**不编造**：CLI 没起得来 / 超时 / 非零退出 / JSON 解不出来，一律返回
``status="error"`` 且 ``output=""``；``source`` 只在**模型真的跑过**时才是 ``"llm"``。
"""

from __future__ import annotations

import asyncio
import json
import os
import shlex
import shutil
import subprocess
import tempfile
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from ..chat_model import usage_tokens
from ..observability import (
    FAILURE_INVALID_OUTPUT,
    FAILURE_RUNTIME_UNAVAILABLE,
    FAILURE_TIMEOUT,
    elapsed_ms,
)
from ..profiles import EmployeeProfile, ProfileNotFound, ProfileRegistry, RuntimeKind
from ..runtime import TaskChannel
from ..state import SubTask, SubTaskResult
from ..versioning import prompt_digest_of
from .projection import ClaudeCodeProjection, ProjectionAdapter, RuntimeBundle
from .sandbox_env import build_child_env, configured_allowlist

#: 一次 CLI 调用的默认上限（秒）。给得宽是因为真跑一轮 agent 要分钟级；测试用桩
#: 脚本时它根本用不到。
DEFAULT_TIMEOUT_SECONDS = float(os.getenv("MATE_AGENT_TEAM_CLAUDE_TIMEOUT", "300"))

#: 工作区根目录。按 ``<root>/<tenant>/<task>`` 分目录——租户是第一段路径，
#: 于是"跨租户读到别人的工作区"在文件系统这一层就不成立（硬规则 #3）。
DEFAULT_WORKSPACE_ROOT = "mate-agent-team-runtimes"

MANIFEST_NAME = "projection.json"
INSTRUCTIONS_NAME = "CLAUDE.md"


def default_cli_command() -> list[str] | None:
    """解析本机的 ``claude`` 可执行文件（找不到就 ``None``）。

    ``MATE_AGENT_TEAM_CLAUDE_BIN`` 优先——它可以是一个路径，也可以带参数
    （按 POSIX 规则切分）。Windows 上 ``shutil.which("claude")`` 会解析到 npm 的
    ``claude.cmd`` shim，``subprocess`` 能直接起它（实测：Python 3.12 +
    Git Bash 环境，``subprocess.run([which_result, "--version"])`` 正常返回）。
    """
    configured = os.getenv("MATE_AGENT_TEAM_CLAUDE_BIN", "").strip()
    if configured:
        return shlex.split(configured)
    found = shutil.which("claude")
    return [found] if found else None


def _safe_segment(value: str, *, field: str) -> str:
    """路径段白名单：租户 / 任务 id 是从**计划与请求**里来的，不能直接拼路径。

    目录穿越（``..``）、分隔符、绝对路径前缀一律拒绝——一个由模型生成的 task_id
    不该有能力把工作区写到根目录去。
    """
    text = (value or "").strip()
    if not text or text in {".", ".."}:
        raise ValueError(f"{field} 不是合法的路径段：{value!r}")
    if any(sep in text for sep in ("/", "\\", "\0")) or ".." in text:
        raise ValueError(f"{field} 含路径分隔或穿越片段：{value!r}")
    return text


class ClaudeCodeRuntime:
    """把一份子任务交给外部 ``claude`` CLI 跑完（并如实回报它跑成什么样）。"""

    def __init__(
        self,
        *,
        registry: ProfileRegistry,
        projection: ProjectionAdapter | None = None,
        cli_command: Sequence[str] | None = None,
        working_root: str | os.PathLike[str] | None = None,
        cli_model: str = "",
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        channel: TaskChannel | None = None,
        env: dict[str, str] | None = None,
    ) -> None:
        self._registry = registry
        self._projection = projection or ClaudeCodeProjection()
        #: 显式给的 CLI（测试用桩脚本）；没给就按环境解析，解析不到**不报错**——
        #: 运行时会把它如实回报成一次失败，而不是悄悄退回别的实现。
        self._cli_command = list(cli_command) if cli_command is not None else default_cli_command()
        root = (
            Path(working_root)
            if working_root
            else Path(tempfile.gettempdir()) / DEFAULT_WORKSPACE_ROOT
        )
        self._working_root = root
        #: 透传给 CLI 的 ``--model``（见模块头：profile.model 不直接透传）。
        self._cli_model = cli_model or os.getenv("MATE_AGENT_TEAM_CLAUDE_MODEL", "")
        self._timeout = timeout
        self._channel = channel
        #: 显式注入给子进程的少量配置。**不是**继承宿主的入口——下放集合由
        #: :meth:`child_env` 按白名单构造（见 :mod:`.sandbox_env`）。
        self._env = dict(env or {})

    # -- 工作区 -------------------------------------------------------------

    def workspace_for(self, *, tenant_id: str, task_id: str) -> Path:
        """该租户该任务的工作区。**租户是第一段路径**——隔离在文件系统层成立。

        但**这不构成安全边界**：同一宿主上的子进程（尤其 root 或同 uid 的）可以
        直接读别的租户目录。真正的隔离靠 ① 子进程拿不到宿主凭据（:mod:`.sandbox_env`）
        ② 远端形态进独立 Job/命名空间（B-8）。这里只做**目录归属**，别把它当墙。
        """
        return (
            self._working_root
            / _safe_segment(tenant_id, field="tenant_id")
            / _safe_segment(task_id, field="task_id")
        )

    def materialise(self, bundle: RuntimeBundle, *, tenant_id: str, task_id: str) -> Path:
        """把投影落盘到按租户隔离的临时工作区，并回填真实路径。

        ``projection.json`` 是**下次审计要看的东西**（下放出去的是哪一份身份），
        ``CLAUDE.md`` 是 CLI 自己会读的项目指令——两者都是引用，不含密钥。
        """
        workspace = self.workspace_for(tenant_id=tenant_id, task_id=task_id)
        workspace.mkdir(parents=True, exist_ok=True)
        landed = RuntimeBundle(
            runtime_kind=bundle.runtime_kind,
            instructions=bundle.instructions,
            skills=bundle.skills,
            tools=bundle.tools,
            model=bundle.model,
            endpoint=bundle.endpoint,
            working_dir=str(workspace),
        )
        (workspace / INSTRUCTIONS_NAME).write_text(bundle.instructions, encoding="utf-8")
        (workspace / MANIFEST_NAME).write_text(
            json.dumps(landed.to_manifest_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return workspace

    # -- 命令行 -------------------------------------------------------------

    def build_command(self, *, bundle: RuntimeBundle, instruction: str) -> list[str]:
        """投影 → 命令行。这一段就是"下投影真的到了执行面"的可读形态。

        ``-p/--print`` 非交互；``--system-prompt`` 注入角色；``--allowedTools``
        下发工具白名单；``--output-format json`` 让回执可解析（``num_turns`` 正好
        是 ``llm_calls`` 的真值，不必猜）。
        """
        command = list(self._cli_command or [])
        command += [
            "-p",
            instruction,
            "--system-prompt",
            bundle.instructions,
            "--output-format",
            "json",
            # 一轮子任务不该在宿主上留会话（外部运行时是**一次性**的执行面）
            "--no-session-persistence",
        ]
        if bundle.tools:
            command += ["--allowedTools", ",".join(bundle.tools)]
        if self._cli_model:
            command += ["--model", self._cli_model]
        return command

    def child_env(self) -> dict[str, str]:
        """下放给 CLI 子进程的环境——**白名单构造**，不是继承宿主。

        公开可读：运维要能核对"到底下放了什么"，测试要能断言"宿主凭据一条都没下去"。
        构造规则见 :mod:`.sandbox_env`；运维追加非敏感名用
        ``MATE_AGENT_TEAM_RUNTIME_ENV_ALLOWLIST``。
        """
        return build_child_env(explicit=self._env, allow=configured_allowlist())

    def _invoke(self, command: Sequence[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
        """同步调用（由 :func:`asyncio.to_thread` 丢到线程里跑）。

        **刻意不用 ``asyncio.create_subprocess_exec``**：Windows 的
        ``SelectorEventLoop``（本仓测试夹具强制切换的那一个，psycopg 要求）不支持
        子进程 transport，会直接 ``NotImplementedError``。丢线程对两种事件循环都成立。

        **刻意不用 ``{**os.environ, ...}``**：那会把宿主的 DB DSN / Service Secret /
        Keycloak 配置原样交给一个跑模型生成指令的执行面（A-4 / ADR-0040）。
        """
        env = self.child_env()
        return subprocess.run(
            list(command),
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=self._timeout,
            env=env,
            check=False,
        )

    @staticmethod
    def _parse(stdout: str) -> tuple[str, int, bool, dict[str, Any]]:
        """解析 ``--output-format json`` 的回执：``(产出, 模型轮次, 是否标错, usage)``。

        第 4 项是 CLI 回执里**原始**的 ``usage``（可能是空 dict）——C-7 的 token
        计量就从这里来。CLI 不给就留空，**不编**（回执里没有的数字，上层按 0 报）。
        """
        lines = [line for line in (stdout or "").splitlines() if line.strip()]
        if not lines:
            raise ValueError("CLI 没有输出任何内容")
        data = json.loads(lines[-1])
        if not isinstance(data, dict):
            raise ValueError("CLI 输出的 JSON 不是对象")
        turns = data.get("num_turns")
        raw_usage = data.get("usage")
        return (
            str(data.get("result") or ""),
            int(turns) if isinstance(turns, int) and turns >= 0 else 1,
            bool(data.get("is_error")),
            dict(raw_usage) if isinstance(raw_usage, dict) else {},
        )

    # -- 运行 ---------------------------------------------------------------

    def _receipt(self, subtask: SubTask) -> SubTaskResult:
        """错误回执的骨架：``source="stub"`` 表示**一次模型调用都没发生**。

        C-7 起带上 ``runtime_kind``：这份回执是**这个执行面**给的，不是"某个
        运行时报的"——外部 CLI 与 superai 的沙箱/权限假设不同，计量要分得开。
        """
        return SubTaskResult(
            task_id=subtask.get("task_id", ""),
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask.get("profile_id", ""),
            status="error",
            output="",
            tool_calls=[],
            llm_calls=0,
            source="stub",
            error="",
            evidence=[],
            runtime_kind=str(RuntimeKind.CLAUDE_CODE),
        )

    @staticmethod
    def _finish(result: SubTaskResult, started: float, failure_category: str = "") -> SubTaskResult:
        """收口计量：耗时与失败类别。**每次 return 前都过一下**（含早退路径）。"""
        result["latency_ms"] = elapsed_ms(started)
        if failure_category:
            result["failure_category"] = failure_category
        return result

    async def _close_channel(self, task_id: str, tenant_id: str, status: str) -> None:
        """置终态（尽力而为，理由同 ``LlmEmployeeRuntime``：收尾失败不该把已跑出的
        回执变成异常）。"""
        if self._channel is None or not task_id:
            return
        try:
            await self._channel.finish(task_id=task_id, tenant_id=tenant_id, status=status)
        except Exception:
            return

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        started = time.perf_counter()
        result = self._receipt(subtask)
        try:
            profile: EmployeeProfile = await self._registry.get(subtask["profile_id"], tenant_id)
        except ProfileNotFound:
            result["error"] = f"员工不存在：{subtask['profile_id']}（租户 {tenant_id}）"
            return self._finish(result, started, FAILURE_RUNTIME_UNAVAILABLE)

        result["profile_id"] = profile.profile_id
        # C-7：模型与提示词摘要。``model`` 取**真正会传给 CLI** 的那一个
        # （``--model`` 配了才有；没配就是 CLI 自己的默认，如实留空）。
        result["model"] = self._cli_model
        result["prompt_digest"] = prompt_digest_of(profile)
        # 工具面取派活闸门**实际发放**的那一份；没走闸门就退回员工白名单（同 superai）。
        allowed = tuple(subtask.get("granted_tools") or profile.tools)
        team_task_id = str(subtask.get("team_task_id") or subtask.get("task_id") or "")

        if self._cli_command is None:
            result["error"] = (
                "claude CLI 不可用：请装 Claude Code，或设 MATE_AGENT_TEAM_CLAUDE_BIN 指向它。"
                "（本运行时不会退回别的实现——那样会变成一次没人察觉的假执行）"
            )
            return self._finish(result, started, FAILURE_RUNTIME_UNAVAILABLE)

        if self._channel is not None and team_task_id:
            await self._channel.start(
                task_id=team_task_id, tenant_id=tenant_id, profile_id=profile.profile_id
            )

        try:
            bundle = self._projection.render(profile, tool_scope=allowed)
            workspace = self.materialise(bundle, tenant_id=tenant_id, task_id=team_task_id)
            command = self.build_command(bundle=bundle, instruction=subtask["instruction"])
            completed = await asyncio.to_thread(self._invoke, command, cwd=workspace)
        except ValueError as exc:
            # 工作区段不合法 / 无法建目录：**没有**真的起过 CLI
            result["error"] = f"{type(exc).__name__}: {exc}"
            await self._close_channel(team_task_id, tenant_id, "failed")
            return self._finish(result, started, FAILURE_RUNTIME_UNAVAILABLE)
        except subprocess.TimeoutExpired:
            result["error"] = f"claude CLI 超时（{self._timeout:.0f}s）未返回"
            await self._close_channel(team_task_id, tenant_id, "failed")
            return self._finish(result, started, FAILURE_TIMEOUT)
        except FileNotFoundError as exc:
            result["error"] = f"claude CLI 起不来：{exc}"
            await self._close_channel(team_task_id, tenant_id, "failed")
            return self._finish(result, started, FAILURE_RUNTIME_UNAVAILABLE)

        try:
            output, turns, is_error, usage = self._parse(completed.stdout)
        except (ValueError, json.JSONDecodeError) as exc:
            result["error"] = (
                f"claude CLI 回执无法解析（退出码 {completed.returncode}）：{exc}；"
                f"stderr={completed.stderr.strip()[:400]}"
            )
            await self._close_channel(team_task_id, tenant_id, "failed")
            return self._finish(result, started, FAILURE_INVALID_OUTPUT)

        # 到这里模型**真的**跑过了：source 与 llm_calls 如实反映它。
        result["source"] = "llm"
        result["llm_calls"] = turns
        # **CLI 给了 usage 才记**，没给就是 0（不编）；整段 CLI 调用的耗时算在
        # ``llm_latency_ms`` 上——外部执行面里"模型"与"工具"是 CLI 内部的事，
        # 分不开，所以 ``tool_latency_ms`` 留 0 而不是拆一个假的比例。
        prompt_tokens, completion_tokens, cached_tokens = usage_tokens(usage)
        result["input_tokens"] = prompt_tokens
        result["output_tokens"] = completion_tokens
        result["cached_tokens"] = cached_tokens
        result["llm_latency_ms"] = elapsed_ms(started)

        if completed.returncode != 0 or is_error:
            stderr = completed.stderr.strip()
            result["error"] = (
                f"claude CLI 退出码 {completed.returncode}（is_error={is_error}）：{output or stderr[:400]}"
            )
            result["output"] = ""
            await self._close_channel(team_task_id, tenant_id, "failed")
            return self._finish(result, started, FAILURE_INVALID_OUTPUT)

        if not output.strip():
            # 跑完了却什么都没说——这本身就是另一种"假回执"，判失败而不是 ok。
            result["error"] = "claude CLI 退出码 0 但产出为空"
            await self._close_channel(team_task_id, tenant_id, "failed")
            return self._finish(result, started, FAILURE_INVALID_OUTPUT)

        await self._close_channel(team_task_id, tenant_id, "completed")
        result["status"] = "ok"
        result["output"] = output
        #: 工具调用明细刻意留空：CLI 的子进程**没有**可信的工具调用回传（`--output-format
        #: json` 只给最终结果），编一份出来就是编造。下放过的工具面在
        #: ``<workspace>/projection.json`` 里，那才是可查的凭据。
        result["tool_calls"] = []
        return self._finish(result, started)


__all__ = [
    "DEFAULT_TIMEOUT_SECONDS",
    "DEFAULT_WORKSPACE_ROOT",
    "INSTRUCTIONS_NAME",
    "MANIFEST_NAME",
    "ClaudeCodeRuntime",
    "default_cli_command",
]
