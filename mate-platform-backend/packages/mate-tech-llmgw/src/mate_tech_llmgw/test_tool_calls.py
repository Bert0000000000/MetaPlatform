"""Tool calls provider adapter tests (ST-5.5.8.2)."""
from __future__ import annotations

import pytest
import respx
from httpx import Response

from mate_tech_llmgw.chat import ChatMessage
from mate_tech_llmgw.providers.anthropic import AnthropicChatProvider
from mate_tech_llmgw.providers.openai import OpenAIChatProvider
from mate_tech_llmgw.tools.registry import tool_calls_from_anthropic, tool_calls_from_openai


@pytest.mark.asyncio
@respx.mock
async def test_openai_tool_calls_parsed() -> None:
    """ST-5.5.8.2: OpenAI tool_calls 解析."""
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
    resp = await p.chat([ChatMessage(role="user", content="weather?")])
    assert resp.finish_reason == "tool_calls"
    assert len(resp.tool_calls) == 1
    assert resp.tool_calls[0]["function"]["name"] == "get_weather"
    await p.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_anthropic_tool_use_parsed() -> None:
    """ST-5.5.8.2: Anthropic tool_use 块解析."""
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=Response(
            200,
            json={
                "model": "claude-3-5-sonnet-20241022",
                "content": [
                    {
                        "type": "text",
                        "text": "I'll search for that.",
                    },
                    {
                        "type": "tool_use",
                        "id": "toolu_1",
                        "name": "kb_search",
                        "input": {"query": "test"},
                    },
                ],
                "stop_reason": "tool_use",
                "usage": {"input_tokens": 5, "output_tokens": 8},
            },
        )
    )
    p = AnthropicChatProvider(api_key="sk-test", model="claude-3-5-sonnet-20241022")
    resp = await p.chat([ChatMessage(role="user", content="search?")])
    assert resp.finish_reason == "tool_use"
    assert len(resp.tool_calls) == 1
    # AnthropicChatProvider normalises Anthropic tool_use blocks
    # into the OpenAI-compatible shape used by tool_calls_from_openai
    # downstream. The function name lives under `function["name"]`,
    # not at the top level.
    assert resp.tool_calls[0]["function"]["name"] == "kb_search"
    assert resp.tool_calls[0]["function"]["arguments"] == {"query": "test"}
    await p.aclose()


def test_tool_calls_from_openai_no_calls() -> None:
    """无 tool_calls → 返回空列表."""
    calls = tool_calls_from_openai([])
    assert calls == []


def test_tool_calls_from_openai_args_dict() -> None:
    """OpenAI args 已为 dict 而非 JSON 字符串."""
    raw = [
        {
            "id": "c1",
            "type": "function",
            "function": {"name": "f", "arguments": {"x": 1}},
        }
    ]
    calls = tool_calls_from_openai(raw)
    assert calls[0].arguments == {"x": 1}


def test_tool_calls_from_anthropic_only_tool_use() -> None:
    """只解析 type=tool_use 块."""
    raw = [
        {"type": "text", "text": "skip"},
        {"type": "tool_use", "id": "t1", "name": "f", "input": {}},
    ]
    calls = tool_calls_from_anthropic(raw)
    assert len(calls) == 1
    assert calls[0].name == "f"