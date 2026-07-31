"""Function calling tools (ST-5.5.8).

统一 tool schema(OpenAI Function format)+ 各 provider tool_calls 适配。
"""
from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    """统一 tool 定义 — OpenAI Function format."""

    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema
    handler: Callable[..., Any] | None = None  # 实际执行函数(可选)

    def to_openai_schema(self) -> dict[str, Any]:
        """转 OpenAI tool schema."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


@dataclass(frozen=True, slots=True)
class ToolCall:
    """统一 tool 调用结果."""

    id: str
    name: str
    arguments: dict[str, Any]


def tool_calls_from_openai(raw: list[dict[str, Any]]) -> list[ToolCall]:
    """解析 OpenAI 风格 tool_calls."""
    result: list[ToolCall] = []
    for tc in raw or []:
        fn = tc.get("function", {})
        args_raw = fn.get("arguments", "{}")
        if isinstance(args_raw, str):
            try:
                args = json.loads(args_raw) if args_raw else {}
            except json.JSONDecodeError:
                logger.warning("tools.args.parse_failed", raw=args_raw)
                args = {}
        else:
            args = args_raw or {}
        result.append(
            ToolCall(
                id=tc.get("id", ""),
                name=fn.get("name", ""),
                arguments=args,
            )
        )
    return result


def tool_calls_from_anthropic(raw: list[dict[str, Any]]) -> list[ToolCall]:
    """解析 Anthropic 风格 tool_use blocks."""
    result: list[ToolCall] = []
    for block in raw or []:
        if block.get("type") != "tool_use":
            continue
        result.append(
            ToolCall(
                id=block.get("id", ""),
                name=block.get("name", ""),
                arguments=block.get("input", {}),
            )
        )
    return result


# 预置 tool 样例
SAMPLE_TOOLS: list[ToolDefinition] = [
    ToolDefinition(
        name="get_weather",
        description="查询指定城市的天气",
        parameters={
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
            },
            "required": ["city"],
        },
    ),
    ToolDefinition(
        name="search_documents",
        description="在知识库中检索相关文档",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    ),
]


async def dispatch_tool_call(
    call: ToolCall,
    tools: list[ToolDefinition],
) -> dict[str, Any]:
    """调度工具调用."""
    for tool in tools:
        if tool.name == call.name and tool.handler is not None:
            try:
                result = tool.handler(**call.arguments)
                if hasattr(result, "__await__"):
                    result = await result
                return {"tool_call_id": call.id, "result": result}
            except Exception as e:
                logger.warning("tools.dispatch.error", name=call.name, error=str(e))
                return {"tool_call_id": call.id, "error": str(e)}
    return {"tool_call_id": call.id, "error": f"Tool '{call.name}' not found"}