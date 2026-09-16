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
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.messages.utils import convert_to_openai_messages
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import ConfigDict, Field


class RunTrace:
    """一次运行内共享的模型面痕迹（``bind_tools`` 的副本也看得见）。

    用可变对象而非模型字段：``bind_tools`` 返回 ``model_copy``，写字段只会写进
    副本，调用方拿到的原件看不到。计数器与"最后一份消息"都必须**共享**。
    """

    __slots__ = ("calls", "last_messages")

    def __init__(self) -> None:
        self.calls = 0
        self.last_messages: list[BaseMessage] = []

    def record(self, messages: list[BaseMessage]) -> None:
        self.calls += 1
        self.last_messages = list(messages)


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
        reply = await self.gateway.chat_with_tools(
            messages=convert_to_openai_messages(messages),
            model=self.llm_model,
            tools=self.bound_tools,
            temperature=self.temperature,
        )
        self.trace.record(messages)
        return ChatResult(generations=[ChatGeneration(message=to_ai_message(reply))])


__all__ = ["LlmgwChatModel", "RunTrace", "to_ai_message"]
