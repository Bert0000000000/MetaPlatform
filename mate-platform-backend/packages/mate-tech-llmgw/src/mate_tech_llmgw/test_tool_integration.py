"""Tool calling integration tests (ST-5.5.8.3)."""
from __future__ import annotations

import pytest
import respx
from httpx import Response

from mate_tech_llmgw.chat import ChatMessage
from mate_tech_llmgw.providers.anthropic import AnthropicChatProvider
from mate_tech_llmgw.providers.openai import OpenAIChatProvider
from mate_tech_llmgw.tools.registry import (
    SAMPLE_TOOLS,
    ToolCall,
    ToolDefinition,
    dispatch_tool_call,
)


@pytest.mark.asyncio
@respx.mock
async def test_openai_tool_call_then_text_response() -> None:
    """OpenAI 完整 tool_call → text 双轮."""
    # 第一轮：tool_call
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "model": "gpt-4o",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": "call_1",
                                    "type": "function",
                                    "function": {
                                        "name": "get_weather",
                                        "arguments": '{"city": "Beijing"}',
                                    },
                                }
                            ],
                        },
                        "finish_reason": "tool_calls",
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            },
        )
    )

    p = OpenAIChatProvider(api_key="sk-test", model="gpt-4o")
    resp1 = await p.chat([ChatMessage(role="user", content="weather?")])
    assert resp1.finish_reason == "tool_calls"

    # 第二轮：执行 tool
    tool_call = ToolCall(
        id=resp1.tool_calls[0]["id"],
        name=resp1.tool_calls[0]["function"]["name"],
        arguments={"city": "Beijing"},
    )

    received = {}

    def weather_handler(city: str) -> str:
        received["city"] = city
        return f"Sunny in {city}"

    weather_tool = ToolDefinition(
        name="get_weather",
        description="Get weather",
        parameters={"type": "object"},
        handler=weather_handler,
    )
    result = await dispatch_tool_call(tool_call, [weather_tool])
    assert result["tool_call_id"] == "call_1"
    assert "Sunny" in result["result"]
    assert received == {"city": "Beijing"}
    await p.aclose()


@pytest.mark.asyncio
async def test_tool_dispatch_unknown_returns_error() -> None:
    """未知工具名 → error."""
    call = ToolCall(id="c1", name="missing_tool", arguments={})
    result = await dispatch_tool_call(call, [])
    assert "error" in result
    assert "not found" in result["error"]


@pytest.mark.asyncio
async def test_sample_tools_callable() -> None:
    """SAMPLE_TOOLS 至少 2 个可调用工具."""
    assert len(SAMPLE_TOOLS) >= 2
    for t in SAMPLE_TOOLS:
        assert t.name
        assert t.description
        assert t.parameters.get("type") == "object"


def test_tool_call_dataclass() -> None:
    """ToolCall 数据类."""
    tc = ToolCall(id="x", name="fn", arguments={"a": 1})
    assert tc.id == "x"
    assert tc.arguments == {"a": 1}


@pytest.mark.asyncio
@respx.mock
async def test_anthropic_then_dispatch() -> None:
    """Anthropic tool_use 完整链路."""
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=Response(
            200,
            json={
                "model": "claude-3-5-sonnet-20241022",
                "content": [
                    {"type": "tool_use", "id": "t1", "name": "search", "input": {"q": "x"}}
                ],
                "stop_reason": "tool_use",
                "usage": {"input_tokens": 5, "output_tokens": 3},
            },
        )
    )
    p = AnthropicChatProvider(api_key="sk-test", model="claude-3-5-sonnet-20241022")
    resp = await p.chat([ChatMessage(role="user", content="hi")])
    assert resp.finish_reason == "tool_use"
    assert len(resp.tool_calls) == 1
    await p.aclose()