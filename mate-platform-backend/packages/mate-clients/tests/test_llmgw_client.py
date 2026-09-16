"""LlmgwClient 的失败分类（1.5 任务 4 的配套）。

重试策略要能用，**报错方得先说清"这次失败是不是可能自己好"**：同一个 400
重试十次还是 400，而 503 / 429 / 连不上则可能下一次就好了。所以
:class:`LlmgwError` 带 ``retryable``，本文件验的就是它标得对不对。
"""

from __future__ import annotations

import asyncio

import httpx
import pytest

from mate_clients.llmgw.client import RETRYABLE_STATUS, LlmgwClient, LlmgwError


def _client(handler: object) -> LlmgwClient:
    client = LlmgwClient("http://mate-tech-llmgw.test:8008")
    # 换掉传输层，其余（URL 拼装 / 解析）走真代码。
    client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))  # type: ignore[arg-type]
    return client


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
