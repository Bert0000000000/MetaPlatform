"""任务 1 · 员工执行循环迁到 LangChain —— 验收用例。

判据（来自 GOAL 任务 1，四条都要）：

1. 执行链路**真的经过 `create_agent`**（断言，不能只是 import）；
2. `summarization` **真的生效**：长上下文 → 证明被压缩（而非原样堆进 prompt）；
3. **TeamBus 公开契约零 LangChain 类型**（R10 守卫，断言 import 边界）；
4. 既有 `EmployeeRuntime` 行为不回归（见 ``test_employee_runtime.py``）。

**为什么判据 1 要用 spy 而不是"看一眼 import"**：import 一个名字不代表链路走它。
``create_agent`` 被替换成"记账后转发真品"的包装，只有**真的调用**才会留痕；
测试还断言它拿到了工具——空跑一遍 ``create_agent`` 不算迁移成功。

**为什么判据 2 要断言「被压缩」而不是「有摘要」**：模型自己说了一句"我总结过了"
不是证据。证据是：摘要器被调过（认提示词里的 marker），且**此后主模型收到的
消息明显短于原始历史**——即原样堆进 prompt 的路径确实被截断了。
"""

from __future__ import annotations

import ast
import pathlib
from typing import Any

import pytest
from mate_tech_agent_team import LlmEmployeeRuntime, ProfileRegistry, SubTask, builtin_profiles
from mate_tech_agent_team.toolbox import McpToolbox

# ── 替身 ────────────────────────────────────────────────────────────────


class RecordingGateway:
    """``chat_with_tools`` 替身：按脚本回话，并记下每次收到的 messages/tools。"""

    def __init__(self, script: list[dict[str, Any]] | None = None) -> None:
        self.script = list(script or [])
        self.calls: list[dict[str, Any]] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append({"messages": messages, "model": model, "tools": tools})
        if self.script:
            return self.script.pop(0)
        return {"content": "（脚本用尽）", "tool_calls": []}


class FakeMcp:
    def __init__(self, descriptors: list[dict[str, Any]] | None = None) -> None:
        self.descriptors = descriptors or []
        self.invoked: list[tuple[str, dict[str, Any]]] = []

    async def list_tools(self) -> list[dict[str, Any]]:
        return self.descriptors

    async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> Any:
        self.invoked.append((name, arguments))
        return {"rows": [{"id": f"{name}-row"}]}


DESCRIPTORS = [
    {
        "name": "kb_search",
        "description": "知识库检索",
        "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}}},
        "agentInvokable": True,
    },
]


def _subtask(instruction: str = "分析本月异常订单") -> SubTask:
    return SubTask(
        task_id="t1", profile_id="EMP-RESEARCHER", instruction=instruction, depends_on=[]
    )


def _runtime(gateway: RecordingGateway, mcp: FakeMcp, **kwargs: Any) -> LlmEmployeeRuntime:
    return LlmEmployeeRuntime(
        registry=ProfileRegistry(builtin_profiles()),
        llm_factory=lambda _t: gateway,
        toolbox_factory=lambda _t: McpToolbox(mcp),
        **kwargs,
    )


# ── 判据 1：链路真的经过 create_agent ───────────────────────────────────


@pytest.mark.asyncio
async def test_execution_really_goes_through_create_agent(monkeypatch: pytest.MonkeyPatch) -> None:
    """spy 记账后转发真品：只有**真调用**才留痕。"""
    from mate_tech_agent_team import employee as emp

    seen: list[dict[str, Any]] = []
    real = emp.create_agent

    def spy(*args: Any, **kwargs: Any):
        seen.append(kwargs)
        return real(*args, **kwargs)

    monkeypatch.setattr(emp, "create_agent", spy)

    gateway = RecordingGateway([{"content": "查完了。", "tool_calls": []}])
    result = await _runtime(gateway, FakeMcp(DESCRIPTORS)).run(
        subtask=_subtask(), tenant_id="tenant-a"
    )

    assert result["status"] == "ok"
    assert seen, "执行链路没有经过 create_agent —— 员工循环还是手写的"
    # 拿到工具才算真迁移（空跑一遍 create_agent 不算）
    assert seen[0].get("tools"), "create_agent 没拿到工具：toolbox 没有产出 LangChain 工具"
    # 中间件至少要有摘要 / 上下文编辑（GOAL 的「白拿的中间件」）
    names = {type(m).__name__ for m in (seen[0].get("middleware") or [])}
    assert "SummarizationMiddleware" in names, f"summarization 中间件没启用：{names}"


@pytest.mark.asyncio
async def test_chat_model_binds_openai_schemas_to_the_gateway() -> None:
    """LangChain 工具 → 打给 llmgw 的仍是 OpenAI function-calling schema。

    **通道没换**：``BaseChatModel`` 只是壳，底层还是 ``chat_with_tools``。
    """
    gateway = RecordingGateway([{"content": "ok", "tool_calls": []}])
    await _runtime(gateway, FakeMcp(DESCRIPTORS)).run(subtask=_subtask(), tenant_id="tenant-a")

    offered = {t["function"]["name"] for t in (gateway.calls[0]["tools"] or [])}
    assert offered == {"kb_search"}, f"工具没按 schema 传下去：{gateway.calls[0]['tools']!r}"
    assert gateway.calls[0]["tools"][0]["type"] == "function"


# ── 判据 2：summarization 真的压缩了上下文 ──────────────────────────────


class _FloodingGateway(RecordingGateway):
    """每次都在回话里塞一大段，把上下文迅速堆过摘要阈值。"""

    def __init__(self, filler: str, rounds: int) -> None:
        super().__init__()
        self._filler = filler
        self._rounds = rounds

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append({"messages": messages, "model": model, "tools": tools})
        if len(self.calls) <= self._rounds:
            return {
                "content": self._filler,
                "tool_calls": [
                    {
                        "id": f"c{len(self.calls)}",
                        "type": "function",
                        "function": {"name": "kb_search", "arguments": '{"query": "x"}'},
                    }
                ],
            }
        return {"content": "最终答复。", "tool_calls": []}


def _text_of(messages: list[dict[str, Any]]) -> str:
    return "\n".join(str(m.get("content") or "") for m in messages)


@pytest.mark.asyncio
async def test_summarization_actually_compresses_long_context() -> None:
    """长上下文必须被**压缩**，而不是原样堆进 prompt。

    证据两件：
      * 摘要器被调过 —— 它带着自己的提示词 marker 打到了网关；
      * 此后主模型收到的消息**明显短于**原始历史 —— 原样堆叠的路径确实被截断。
    """
    marker = "SUMMARIZE-MARKER-9f2c"
    filler = "很长的中间产物。" * 600  # ≈ 4800 字/轮
    gateway = _FloodingGateway(filler, rounds=4)

    runtime = _runtime(
        gateway,
        FakeMcp(DESCRIPTORS),
        max_tool_rounds=8,
        summary_prompt=marker + "\n{messages}",  # type: ignore[call-arg]
        summarization_trigger=("tokens", 400),  # type: ignore[call-arg]
        summarization_keep=("messages", 2),  # type: ignore[call-arg]
    )
    result = await runtime.run(subtask=_subtask(), tenant_id="tenant-a")
    assert result["status"] == "ok"

    all_text = "\n".join(_text_of(c["messages"]) for c in gateway.calls)
    assert marker in all_text, (
        f"摘要器从没被调用过 —— summarization 中间件没生效（共 {len(gateway.calls)} 次模型调用）"
    )

    peak = max(len(_text_of(c["messages"])) for c in gateway.calls)
    last = len(_text_of(gateway.calls[-1]["messages"]))
    assert last < peak, (
        "上下文没有被压缩：最后一次主模型调用收到的消息不比峰值短"
        f"（峰值 {peak} 字符，最后 {last} 字符）—— 原样堆进 prompt 了"
    )


# ── 判据 3：TeamBus 公开契约零 LangChain 类型（R10） ────────────────────

_FRAMEWORKS = {
    "langchain",
    "langchain_core",
    "langchain_core_tools",
    "langgraph",
    "langchain_mcp_adapters",
}


def _imported_roots(path: pathlib.Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots.add(node.module.split(".")[0])
    return roots


@pytest.mark.parametrize(
    "relative",
    ["team_bus.py", "authority.py", "runtime.py", "state.py", "api/schemas.py", "api/app.py"],
)
def test_teambus_public_contract_imports_no_framework(relative: str) -> None:
    """R10：框架必须待在 adapter 之后。公开契约里出现框架 import 就是渗漏。

    将来 ``RuntimeKind.CODEX`` / ``DSH`` 的子 agent 若被 LangChain 类型塑形，
    TeamBus 语义就不再 runtime 中立——这条断言是那件事的第一道门。
    """
    import mate_tech_agent_team as pkg

    path = pathlib.Path(pkg.__file__).parent / relative
    leaked = _imported_roots(path) & _FRAMEWORKS
    assert not leaked, f"{relative} 的公开契约渗漏了框架 import：{sorted(leaked)}"


def test_teambus_public_signatures_expose_no_framework_types() -> None:
    """运行时再判一次：公开方法的注解里不得出现框架类型。"""
    import inspect

    from mate_tech_agent_team.team_bus import TeamBus

    offenders: list[str] = []
    for name, member in inspect.getmembers(TeamBus, callable):
        if name.startswith("_"):
            continue
        for annotation in inspect.get_annotations(member).values():
            text = str(annotation)
            if text.split(".", maxsplit=1)[0] in _FRAMEWORKS:
                offenders.append(f"{name}: {text}")
    assert not offenders, f"TeamBus 公开签名暴露了框架类型：{offenders}"
