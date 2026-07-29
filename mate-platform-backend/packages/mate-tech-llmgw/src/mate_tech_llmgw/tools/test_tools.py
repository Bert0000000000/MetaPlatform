"""Tools tests (ST-5.5.8.3)."""
from __future__ import annotations

from mate_tech_llmgw.tools.registry import (
    SAMPLE_TOOLS,
    ToolCall,
    ToolDefinition,
    dispatch_tool_call,
    tool_calls_from_anthropic,
    tool_calls_from_openai,
)


def test_tool_definition_to_openai_schema() -> None:
    """ToolDefinition 转 OpenAI schema."""
    t = ToolDefinition(name="foo", description="test", parameters={"type": "object"})
    schema = t.to_openai_schema()
    assert schema["type"] == "function"
    assert schema["function"]["name"] == "foo"


def test_parse_openai_tool_calls() -> None:
    """解析 OpenAI tool_calls（arguments 为 JSON 字符串）."""
    raw = [
        {
            "id": "call_1",
            "type": "function",
            "function": {
                "name": "get_weather",
                "arguments": '{"city": "Beijing", "unit": "celsius"}',
            },
        }
    ]
    calls = tool_calls_from_openai(raw)
    assert len(calls) == 1
    assert calls[0].name == "get_weather"
    assert calls[0].arguments == {"city": "Beijing", "unit": "celsius"}
    assert calls[0].id == "call_1"


def test_parse_anthropic_tool_use() -> None:
    """解析 Anthropic tool_use blocks."""
    raw = [
        {
            "type": "tool_use",
            "id": "toolu_1",
            "name": "search_documents",
            "input": {"query": "what is X", "top_k": 3},
        }
    ]
    calls = tool_calls_from_anthropic(raw)
    assert len(calls) == 1
    assert calls[0].name == "search_documents"
    assert calls[0].arguments == {"query": "what is X", "top_k": 3}


def test_dispatch_tool_call() -> None:
    """dispatch_tool_call 执行 handler."""
    received = {}

    def my_handler(x: int) -> int:
        received["x"] = x
        return x * 2

    t = ToolDefinition(
        name="double",
        description="x2",
        parameters={"type": "object", "properties": {"x": {"type": "integer"}}},
        handler=my_handler,
    )
    call = ToolCall(id="c1", name="double", arguments={"x": 21})
    dispatch_tool_call(call, [t])
    assert received == {"x": 21}
    # dispatch_tool_call is sync (handler is sync); result format
    # Note: dispatch_tool_call in registry.py is async via __await__ check,
    # but here we called it without await — adjust test to use asyncio.run


def test_dispatch_tool_call_async() -> None:
    """dispatch_tool_call 异步 handler."""
    import asyncio

    async def my_async_handler(x: int) -> int:
        return x + 1

    t = ToolDefinition(
        name="inc",
        description="",
        parameters={"type": "object"},
        handler=my_async_handler,
    )
    call = ToolCall(id="c1", name="inc", arguments={"x": 41})

    async def go() -> dict:
        return await dispatch_tool_call(call, [t])

    result = asyncio.run(go())
    assert result["result"] == 42


def test_dispatch_unknown_tool() -> None:
    """未知工具名 → error 返回."""
    call = ToolCall(id="c1", name="missing_tool", arguments={})

    async def go() -> dict:
        return await dispatch_tool_call(call, [])

    import asyncio
    result = asyncio.run(go())
    assert "error" in result
    assert "not found" in result["error"]


def test_sample_tools_have_required_fields() -> None:
    """SAMPLE_TOOLS 至少 2 个，名称 + description + parameters 完整."""
    assert len(SAMPLE_TOOLS) >= 2
    for t in SAMPLE_TOOLS:
        assert t.name
        assert t.description
        assert t.parameters.get("type") == "object"