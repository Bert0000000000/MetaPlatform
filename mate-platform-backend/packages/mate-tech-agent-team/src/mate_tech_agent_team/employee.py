"""数字员工运行时（治 D-10「派活返回假回执」）。

**"真实执行"的含义**：一个员工被派活后，必须

1. 真的把它的**提示词**发出去（不是把原话抄回去）；
2. 真的调 **LLM 网关**做一轮函数调用决策；
3. 真的把工具调用打到 **MCP 中心**并拿回结果（白名单外的被拒且不落网）；
4. 把模型的**产出**作为 ``output`` 返回，而不是 ``instruction`` 的副本。

回执里的 ``source`` 与 ``llm_calls`` 就是这条链的凭据：调用方据此断言"真跑了"。
``output == instruction`` 的实现会被测试直接判红。

**客户端按租户构造**（工厂注入）：llmgw 与 MCP 中心都按 ``X-Tenant-Id``
取租户配置，共享单例会跨租户串味，所以每次运行现开现关。
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any, Protocol

from .profiles import EmployeeProfile, ProfileNotFound, ProfileRegistry
from .skills import SkillCatalog
from .state import SubTask, SubTaskResult
from .toolbox import Toolbox, ToolNotAllowed

#: 一条工具结果最多回灌多少字符——上下文裁剪（ADR-0066 §5.4）的最小形态
TOOL_RESULT_CHARS = 4000


class LlmGateway(Protocol):
    """对 LLM 网关的最小依赖面（生产是 :class:`mate_clients.llmgw.LlmgwClient`）。"""

    async def chat_with_tools(
        self,
        *,
        messages: list[dict[str, Any]],
        model: str,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
    ) -> dict[str, Any]: ...


LlmFactory = Callable[[str], LlmGateway]
ToolboxFactory = Callable[[str], Toolbox]


async def aclose_quietly(client: object) -> None:
    """关掉带 ``aclose`` 的客户端；没有就跳过。"""
    close = getattr(client, "aclose", None)
    if close is not None:
        await close()


def _clip(value: Any, limit: int = TOOL_RESULT_CHARS) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    if len(text) <= limit:
        return text
    return text[:limit] + f"…（已截断，原长 {len(text)} 字符）"


class LlmEmployeeRuntime:
    """把一份子任务真的跑完的员工运行时。"""

    def __init__(
        self,
        *,
        registry: ProfileRegistry,
        llm_factory: LlmFactory,
        toolbox_factory: ToolboxFactory,
        skills: SkillCatalog | None = None,
        max_tool_rounds: int = 3,
        temperature: float = 0.7,
    ) -> None:
        self._registry = registry
        self._llm_factory = llm_factory
        self._toolbox_factory = toolbox_factory
        self._skills = skills
        self._max_tool_rounds = max_tool_rounds
        self._temperature = temperature

    def _system_prompt(self, profile: EmployeeProfile) -> str:
        """身份提示词 + **技能清单**（只出名字与一句话描述，不出正文）。"""
        parts = [profile.system_prompt.strip()]
        if "ont_" in " ".join(profile.tools):
            parts.append(
                "【本体使用规则】涉及本体对象时，rid 必须来自 ont_list_classes 的返回："
                "先列清单、从中挑选，**禁止凭业务名词自己拼造 rid**（拼出来的必 404）。"
                "清单里没有你要的类型，就如实说没有，不要换一个名字再试。"
            )
        if self._skills is not None and profile.skills:
            manifest = self._skills.render(profile.skills)
            if manifest:
                parts.append(
                    "你可以使用以下技能。清单里只有名字与一句话说明；"
                    "需要具体做法时先调用 read_skill 取全文，不要凭名字臆测。\n" + manifest
                )
        return "\n\n".join(parts)

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        result = SubTaskResult(
            task_id=subtask.get("task_id", ""),
            profile_id=subtask.get("profile_id", ""),
            status="error",
            source="llm",
            llm_calls=0,
            tool_calls=[],
        )
        try:
            profile = self._registry.get(subtask["profile_id"])
        except ProfileNotFound:
            result["error"] = f"员工不存在：{subtask['profile_id']}（租户 {tenant_id}）"
            return result

        result["profile_id"] = profile.profile_id
        allowed = profile.tools
        tool_log: list[dict[str, Any]] = []
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": self._system_prompt(profile)},
            {"role": "user", "content": subtask["instruction"]},
        ]

        llm = self._llm_factory(tenant_id)
        toolbox = self._toolbox_factory(tenant_id)
        llm_calls = 0
        try:
            schemas = await toolbox.schemas(allowed=allowed)
            content = ""
            for _ in range(self._max_tool_rounds + 1):
                reply = await llm.chat_with_tools(
                    messages=messages,
                    model=profile.model,
                    tools=schemas or None,
                    temperature=self._temperature,
                )
                llm_calls += 1
                content = str(reply.get("content") or "")
                calls = reply.get("tool_calls") or []
                if not calls:
                    break
                messages.append({"role": "assistant", "content": content, "tool_calls": calls})
                for call in calls:
                    entry, tool_message = await self._dispatch(
                        call, allowed=allowed, toolbox=toolbox
                    )
                    tool_log.append(entry)
                    messages.append(tool_message)
            else:
                # 工具轮次用尽、模型仍在要工具：再要一次**纯文本**答复（不给工具）。
                # 否则员工会以 status=ok 返回空产出——跑是跑完了却什么也没说，
                # 这本身就是另一种"假回执"（实测：研究员连调 8 次知识库后产出为空串）。
                final = await llm.chat_with_tools(
                    messages=messages,
                    model=profile.model,
                    tools=None,
                    temperature=self._temperature,
                )
                llm_calls += 1
                content = str(final.get("content") or "")
        except Exception as exc:  # 运行期故障（网关/中心/网络）不应炸掉整轮编排
            result["error"] = f"{type(exc).__name__}: {exc}"
            result["tool_calls"] = tool_log
            result["llm_calls"] = llm_calls
            return result
        finally:
            await aclose_quietly(llm)
            await aclose_quietly(toolbox)

        result["status"] = "ok"
        result["output"] = content
        result["llm_calls"] = llm_calls
        result["tool_calls"] = tool_log
        return result

    async def _dispatch(
        self, call: dict[str, Any], *, allowed: tuple[str, ...], toolbox: Toolbox
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        function = call.get("function") or {}
        name = str(function.get("name") or "")
        raw_args = function.get("arguments")
        try:
            arguments: dict[str, Any] = (
                json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
            )
        except json.JSONDecodeError:
            arguments = {"_raw": raw_args}

        entry: dict[str, Any] = {"name": name, "arguments": arguments}
        try:
            result = await toolbox.invoke(name=name, arguments=arguments, allowed=allowed)
            entry["allowed"] = True
            content = _clip(result)
        except ToolNotAllowed as exc:
            # 闸门拒绝：记下来，并且**没有**真的打到后端
            entry["allowed"] = False
            entry["rejected"] = exc.reason
            content = json.dumps(
                {"error": f"tool '{name}' rejected: {exc.reason}"}, ensure_ascii=False
            )
        except Exception as exc:
            # 工具**执行**失败（多为参数不合后端 schema）——把错误原文回灌给模型，
            # 让它自己改参数重试，而不是把一次手滑升级成整轮失败。
            entry["allowed"] = True
            entry["error"] = f"{type(exc).__name__}: {exc}"
            content = _clip({"error": f"tool '{name}' failed: {exc}", "hint": "修正参数后重试"})
        return entry, {
            "role": "tool",
            "tool_call_id": str(call.get("id") or name),
            "content": content,
        }


__all__ = [
    "TOOL_RESULT_CHARS",
    "LlmEmployeeRuntime",
    "LlmFactory",
    "LlmGateway",
    "ToolboxFactory",
    "aclose_quietly",
]
