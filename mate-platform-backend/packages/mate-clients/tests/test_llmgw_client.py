"""LlmgwClient 的失败分类（1.5 任务 4 的配套）。

重试策略要能用，**报错方得先说清"这次失败是不是可能自己好"**：同一个 400
重试十次还是 400，而 503 / 429 / 连不上则可能下一次就好了。所以
:class:`LlmgwError` 带 ``retryable``，本文件验的就是它标得对不对。
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable

import httpx
import pytest

from mate_clients.llmgw.client import RETRYABLE_STATUS, LlmgwClient, LlmgwError

#: 假传输的处理器形状与 ``httpx.MockTransport`` 收的一致。
Handler = Callable[[httpx.Request], httpx.Response]


def _client(handler: Handler) -> LlmgwClient:
    # 只换传输层，其余（URL 拼装 / 状态码 / 解析）走真代码。
    return LlmgwClient("http://mate-tech-llmgw.test:8008", transport=httpx.MockTransport(handler))


def _call(client: LlmgwClient) -> dict:
    return asyncio.run(client.chat_with_tools(messages=[], model="glm-5.3-flash"))


def test_the_retryable_status_table_covers_throttling_and_upstream_faults() -> None:
    assert frozenset({429, 500, 502, 503, 504}) == RETRYABLE_STATUS


@pytest.mark.parametrize("status", sorted(RETRYABLE_STATUS))
def test_upstream_faults_are_marked_retryable(status: int) -> None:
    client = _client(lambda _request: httpx.Response(status, text="upstream busy"))
    with pytest.raises(LlmgwError) as excinfo:
        _call(client)
    assert excinfo.value.retryable is True, f"{status} 应标成可重试"


@pytest.mark.parametrize("status", [400, 401, 404, 422])
def test_request_errors_are_not_marked_retryable(status: int) -> None:
    """请求本身的问题：重试多少次都是一样的结果。"""
    client = _client(lambda _request: httpx.Response(status, text="bad request"))
    with pytest.raises(LlmgwError) as excinfo:
        _call(client)
    assert excinfo.value.retryable is False, f"{status} 不该标成可重试"


def test_a_transport_failure_is_marked_retryable() -> None:
    """连不上 / 被断开：下一次可能就好了。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    with pytest.raises(LlmgwError) as excinfo:
        _call(_client(handler))
    assert excinfo.value.retryable is True
    assert "transport error" in str(excinfo.value)


def test_a_non_json_body_is_not_marked_retryable() -> None:
    """200 但不是 JSON：多半是网关配错了，重试不会变好。"""
    client = _client(lambda _request: httpx.Response(200, text="<html>oops</html>"))
    with pytest.raises(LlmgwError) as excinfo:
        _call(client)
    assert excinfo.value.retryable is False


# ---------------------------------------------------------------------------
# 假回执闸门（批次 llmgw-fallback-hardening）
# ---------------------------------------------------------------------------
def _capture_bodies(seen: list[dict]) -> Handler:
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"content": "ok", "model": "glm-5.3-flash"})

    return handler


def test_default_still_allows_the_stub_fallback() -> None:
    """回归：不带该开关的调用方，请求体里仍是 allow_stub_fallback=true
    —— 其它服务还在用这条通道，本批**不**顺手关掉它们已有的降级能力。"""
    seen: list[dict] = []
    _call(_client(_capture_bodies(seen)))
    assert seen[0]["allow_stub_fallback"] is True


def test_disabling_the_stub_fallback_reaches_the_request_body() -> None:
    """Agent 产品层：关掉之后，llmgw 才可能在字段上拒绝回显。"""
    seen: list[dict] = []
    client = LlmgwClient(
        "http://mate-tech-llmgw.test:8008",
        transport=httpx.MockTransport(_capture_bodies(seen)),
        allow_stub_fallback=False,
    )
    _call(client)
    assert seen[0]["allow_stub_fallback"] is False


def test_the_flag_is_sent_on_the_plain_completion_path_too() -> None:
    """不带工具的普通补全走的是另一段拼装，同样要带上开关。"""
    seen: list[dict] = []
    client = LlmgwClient(
        "http://mate-tech-llmgw.test:8008",
        transport=httpx.MockTransport(_capture_bodies(seen)),
        allow_stub_fallback=False,
    )
    asyncio.run(client.chat_completion(messages=[], model="glm-5.3-flash"))
    assert seen[0]["allow_stub_fallback"] is False
