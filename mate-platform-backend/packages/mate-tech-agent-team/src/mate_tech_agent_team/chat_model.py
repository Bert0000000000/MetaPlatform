"""``BaseChatModel`` 壳：把自研 llmgw 网关接进 LangChain 的模型面。

**通道没换**（GOAL 锁死决策）：这个类不是新的 LLM 客户端，它只是把
LangChain 的 ``BaseMessage`` / 工具 schema 翻译成 llmgw 既有的
``chat_with_tools(messages, model, tools, temperature)`` 调用面，再把回包翻回来。
底层仍是 :class:`mate_clients.llmgw.LlmgwClient`——租户配置、用户令牌透传、
provider 解析、三层计量全都不动。

**为什么值得包这一层**：包上之后就能把员工循环交给 ``create_agent``，白拿
它的中间件（摘要 / 上下文编辑 / 工具轮次上限），而不必自己维护一套消息格式。

**调用计数**：``llm_calls`` 是 1.0 回执里的"真跑过"凭据（D-10），所以计数跟着
模型实例走，且**绑过工具的副本共用同一个 :class:`RunTrace`**——``bind_tools``
返回的是 ``model_copy``，浅拷贝会带同一个对象。

**计量（C-7）**：网关回包里的 ``usage`` 在这里被归一化成
``(input, output, cached)`` 三个计数，加上**每一轮模型调用的耗时**，一起攒进
:class:`RunTrace`。这是本服务唯一**真的**拿得到 token 数的地方（``llmgw`` 的
``chat/real`` 回包带 ``usage``）——所以 token 字段的填充点就选在这里，而不是在
上层的某个"看起来合适"的地方编一个。
"""

from __future__ import annotations

import json
import time
from typing import Any

from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.messages.utils import convert_to_openai_messages
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import ConfigDict, Field

from .observability import SPAN_LLM, Correlation, elapsed_ms, emit


def _as_count(value: Any) -> int:
    """``usage`` 里的一个计数。类型不对就是 0——**不猜**，也不四舍五入一个假数。"""
    return int(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0


def usage_tokens(usage: Any) -> tuple[int, int, int]:
    """``usage`` → ``(input_tokens, output_tokens, cached_tokens)``。

    键名认两种形态：OpenAI 形状的 ``prompt_tokens`` / ``completion_tokens``，以及
    缓存命中量的两处常见落点（``cached_tokens`` 与
    ``prompt_tokens_details.cached_tokens``）。**认不出来就是 0**：宁可报"这次
    没有计量数据"，也不要拿一个猜出来的数字进成本口径。
    """
    if not isinstance(usage, dict):
        return 0, 0, 0
    details = usage.get("prompt_tokens_details")
    cached = usage.get("cached_tokens")
    if cached is None and isinstance(details, dict):
        cached = details.get("cached_tokens")
    return (
        _as_count(usage.get("prompt_tokens")),
        _as_count(usage.get("completion_tokens")),
        _as_count(cached),
    )


class RunTrace:
    """一次运行内共享的模型面痕迹（``bind_tools`` 的副本也看得见）。

    用可变对象而非模型字段：``bind_tools`` 返回 ``model_copy``，写字段只会写进
    副本，调用方拿到的原件看不到。计数器与"最后一份消息"都必须**共享**。

    C-7 起它同时是**计量累加器**：token 三类计数与模型调用耗时都攒在这里，由
    ``LlmEmployeeRuntime`` 在跑完之后一次性写进回执。
    """

    __slots__ = (
        "cached_tokens",
        "calls",
        "input_tokens",
        "last_messages",
        "latency_ms",
        "output_tokens",
    )

    def __init__(self) -> None:
        self.calls = 0
        self.last_messages: list[BaseMessage] = []
        self.input_tokens = 0
        self.output_tokens = 0
        self.cached_tokens = 0
        self.latency_ms = 0

    def record(
        self, messages: list[BaseMessage], *, usage: Any = None, latency_ms: int = 0
    ) -> None:
        self.calls += 1
        self.last_messages = list(messages)
        prompt, completion, cached = usage_tokens(usage)
        self.input_tokens += prompt
        self.output_tokens += completion
        self.cached_tokens += cached
        self.latency_ms += max(0, int(latency_ms))


def _parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw}
    return parsed if isinstance(parsed, dict) else {"_value": parsed}


def to_ai_message(reply: dict[str, Any]) -> AIMessage:
    """llmgw 回包（OpenAI 形状）→ LangChain ``AIMessage``。"""
    tool_calls = []
    for call in reply.get("tool_calls") or []:
        function = call.get("function") or {}
        tool_calls.append(
            {
                "name": str(function.get("name") or ""),
                "args": _parse_arguments(function.get("arguments")),
                "id": str(call.get("id") or function.get("name") or ""),
                "type": "tool_call",
            }
        )
    return AIMessage(content=str(reply.get("content") or ""), tool_calls=tool_calls)


class LlmgwChatModel(BaseChatModel):
    """自研 llmgw 网关的 LangChain 模型面（**只包一层，不换通道**）。"""

    model_config = ConfigDict(arbitrary_types_allowed=True, protected_namespaces=())

    #: 底层网关：任何实现了 ``chat_with_tools`` 的对象（生产是 ``LlmgwClient``）。
    gateway: Any
    #: 传给上游的模型名（取自员工定义，如 ``glm-5.3-flash``）。
    llm_model: str = "glm-5.3-flash"
    temperature: float = 0.7
    #: ``bind_tools`` 之后挂上的 OpenAI function-calling schema。
    bound_tools: list[dict[str, Any]] | None = None
    trace: RunTrace = Field(default_factory=RunTrace)
    #: C-7 观测：记录器与关联键。默认 ``None`` = 不记（既有用例行为逐字不变）。
    #: ``bind_tools`` 走 ``model_copy``，所以绑过工具的副本**共用**同一份。
    recorder: Any = None
    correlation: Any = None

    @property
    def _llm_type(self) -> str:
        return "llmgw"

    def bind_tools(self, tools: Any, **kwargs: Any) -> Any:  # type: ignore[override]
        """把 LangChain 工具翻成 OpenAI schema，随每次调用打给网关。

        刻意**不走** ``RunnableBinding``：本仓的网关是"每轮自带工具清单"的
        HTTP 面，绑定结果直接放回模型副本更直白，也便于测试断言工具确实传下去了。
        """
        schemas = [convert_to_openai_tool(tool) for tool in tools]
        return self.model_copy(update={"bound_tools": schemas})

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        # 员工链路全程 async（FastAPI + langgraph ainvoke）；同步面不提供。
        raise NotImplementedError("LlmgwChatModel 只支持异步调用（ainvoke）")

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        started = time.perf_counter()
        reply = await self.gateway.chat_with_tools(
            messages=convert_to_openai_messages(messages),
            model=self.llm_model,
            tools=self.bound_tools,
            temperature=self.temperature,
        )
        elapsed = elapsed_ms(started)
        usage = reply.get("usage") if isinstance(reply, dict) else None
        self.trace.record(messages, usage=usage, latency_ms=elapsed)
        prompt, completion, cached = usage_tokens(usage)
        emit(
            self.recorder,
            SPAN_LLM,
            correlation=self.correlation or Correlation(),
            name=self.llm_model,
            duration_ms=elapsed,
            attributes={
                "model": self.llm_model,
                "inputTokens": prompt,
                "outputTokens": completion,
                "cachedTokens": cached,
                "llmCalls": 1,
            },
        )
        return ChatResult(generations=[ChatGeneration(message=to_ai_message(reply))])


__all__ = ["LlmgwChatModel", "RunTrace", "to_ai_message", "usage_tokens"]
