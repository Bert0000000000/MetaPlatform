"""Tests for mate-tech-llmgw (ST-5.5.2.3 + ST-5.5.3.4 + ST-5.5.3.2)."""
from __future__ import annotations

import respx
from httpx import Response

from mate_tech_llmgw.chat import ChatMessage, ChatResponse
from mate_tech_llmgw.providers.openai import OpenAIChatProvider
from mate_tech_llmgw.providers.anthropic import AnthropicChatProvider
from mate_tech_llmgw.providers.qwen import QwenChatProvider
from mate_tech_llmgw.providers.doubao import DoubaoChatProvider
from mate_tech_llmgw.router import _provider_name, get_provider, reset_providers


def test_provider_name_routing() -> None:
    """ST-5.5.3.4: 4 provider 路由正确."""
    assert _provider_name("gpt-4o") == "openai"
    assert _provider_name("gpt-4o-mini") == "openai"
    assert _provider_name("claude-3-5-sonnet-20241022") == "anthropic"
    assert _provider_name("claude-3-haiku-20240307") == "anthropic"
    assert _provider_name("qwen-turbo") == "qwen"
    assert _provider_name("qwen-max") == "qwen"
    assert _provider_name("doubao-pro") == "doubao"
    assert _provider_name("doubao-pro-32k") == "doubao"
    # 前缀兜底
    assert _provider_name("gpt-4-foo") == "openai"
    assert _provider_name("claude-2.1") == "anthropic"
    assert _provider_name("qwen-foo") == "qwen"
    assert _provider_name("doubao-foo") == "doubao"
    # 未知默认 openai
    assert _provider_name("unknown-model") == "openai"


def test_provider_factory_lazy_load() -> None:
    """ST-5.5.3.3: get_provider 懒加载 + 单例."""
    reset_providers()
    p1 = get_provider("gpt-4o")
    p2 = get_provider("gpt-4o")
    assert p1 is p2
    assert isinstance(p1, OpenAIChatProvider)


def test_anthropic_factory_lazy_load() -> None:
    reset_providers()
    p1 = get_provider("claude-3-5-sonnet-20241022")
    assert isinstance(p1, AnthropicChatProvider)


def test_qwen_factory_lazy_load() -> None:
    """ST-5.5.3.2: Qwen provider 可构造."""
    reset_providers()
    p1 = get_provider("qwen-turbo")
    assert isinstance(p1, QwenChatProvider)


def test_doubao_factory_lazy_load() -> None:
    """ST-5.5.3.2: Doubao provider 可构造."""
    reset_providers()
    p1 = get_provider("doubao-pro")
    assert isinstance(p1, DoubaoChatProvider)


@respx.mock
async def test_openai_chat_mock() -> None:
    """ST-5.5.2.3: chat mock 跑通."""
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "id": "chatcmpl-1",
                "model": "gpt-4o",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "hello"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7},
            },
        )
    )
    p = OpenAIChatProvider(api_key="sk-test", model="gpt-4o")
    msgs = [ChatMessage(role="user", content="hi")]
    resp = await p.chat(msgs, temperature=0.0)
    assert resp.content == "hello"
    assert resp.model == "gpt-4o"
    assert resp.usage["total_tokens"] == 7
    await p.aclose()


@respx.mock
async def test_qwen_chat_mock() -> None:
    """ST-5.5.3.2: Qwen mock 跑通."""
    respx.post("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "model": "qwen-turbo",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "你好"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5},
            },
        )
    )
    p = QwenChatProvider(api_key="sk-test", model="qwen-turbo")
    msgs = [ChatMessage(role="user", content="hi")]
    resp = await p.chat(msgs)
    assert resp.content == "你好"
    assert resp.model == "qwen-turbo"
    await p.aclose()


def test_chat_message_dataclass() -> None:
    m = ChatMessage(role="user", content="x")
    assert m.role == "user"
    assert m.content == "x"
    r = ChatResponse(content="c", model="m")
    assert r.content == "c"
    assert r.tool_calls == []