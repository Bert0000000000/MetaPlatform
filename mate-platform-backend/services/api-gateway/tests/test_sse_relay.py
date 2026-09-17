"""网关必须**边收边发**地转发 `text/event-stream`（1.7 任务 2 抓出的真 bug）。

1.3 起 agent-team 就有 `GET /runs/{id}/events` 这条 SSE，1.5 还给它加了"回放 +
尾随"。但**它从来没经网关在浏览器里验过**：网关的转发是
`upstream = await client.request(...)` 再 `Response(content=upstream.content)`
——那是**把整个响应体读完再回话**。SSE 于是在网关这里攒着，客户端直到流结束才
收到第一个字节。

而 agent-team 的事件流**停在人工确认闸门时不会关流**（那是刻意的），所以浏览器
里是**永远收不到**——"步骤实时出现"根本无从谈起。实测：直连 8013 首个事件
+0.12s 到达；经 8100 则连响应头都拿不到。

修法：`Accept: text/event-stream` 的请求走 `client.send(..., stream=True)` +
`StreamingResponse`，边收边发。这条用例用一个**永不结束**的上游流把"有没有
攒着不发"钉死：只要第一行读得到，就说明网关没有等流结束。
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

import httpx
import pytest
import uvicorn
from mate_api_gateway.main import app

_EVENTS_PATH = "/api/v1/agent-team/runs/r1/events"


class _HangingStream(httpx.AsyncByteStream):
    """先给一块，然后**永不结束**——"停在闸门不关流"的 run 就是这样。"""

    def __init__(self, chunk: bytes) -> None:
        self._chunk = chunk

    async def __aiter__(self) -> AsyncIterator[bytes]:
        yield self._chunk
        await asyncio.Event().wait()

    async def aclose(self) -> None:
        return None


def _mock_upstream(
    chunk: bytes, content_type: str = "text/event-stream", *, hanging: bool = True
) -> httpx.AsyncClient:
    """上游替身。``hanging=True`` 时流**永不结束**（模拟停在闸门的 run 的事件流）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        del request
        if hanging:
            return httpx.Response(
                200, headers={"content-type": content_type}, stream=_HangingStream(chunk)
            )
        return httpx.Response(200, headers={"content-type": content_type}, content=chunk)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def _serve() -> tuple[uvicorn.Server, asyncio.Task[None], int]:
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    serve = asyncio.create_task(server.serve())
    for _ in range(250):
        if server.started:
            break
        await asyncio.sleep(0.02)
    assert server.started, "uvicorn 没起来"
    port = server.servers[0].sockets[0].getsockname()[1]
    return server, serve, port


async def _shut_down(server: uvicorn.Server, serve: asyncio.Task[None]) -> None:
    server.should_exit = True
    try:
        await asyncio.wait_for(serve, 10)
    except TimeoutError:  # pragma: no cover - 修复前那条挂住的请求
        server.force_exit = True
        await asyncio.wait_for(serve, 5)


@pytest.mark.asyncio
async def test_sse_is_relayed_before_the_stream_ends() -> None:
    """上游不结束，网关也得把已经收到的部分先发出来。"""
    original = getattr(app.state, "client", None)
    upstream = _mock_upstream(b'event: step\ndata: {"seq": 1}\n\n')
    server, serve, port = await _serve()
    try:
        # 起服务之后再换：lifespan 会建自己的 client，换早了会被它覆盖
        app.state.client = upstream
        async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}", timeout=10) as client:
            async with client.stream(
                "GET", _EVENTS_PATH, headers={"Accept": "text/event-stream"}
            ) as response:
                assert response.status_code == 200
                assert response.headers["content-type"].startswith("text/event-stream")

                lines = response.aiter_lines()
                got: list[str] = []
                # 上游永不结束：这里读得到，就说明网关**没有**等它结束
                for _ in range(3):
                    got.append(await asyncio.wait_for(anext(lines), 5))
                body = "\n".join(got)
                assert "event: step" in body, f"网关没把第一步转发出来：{body!r}"
                assert '"seq": 1' in body, body
    finally:
        await _shut_down(server, serve)
        await upstream.aclose()
        if original is not None:
            app.state.client = original


@pytest.mark.asyncio
async def test_ordinary_responses_still_come_back_whole() -> None:
    """非流式响应照旧整份回（顺便钉住"改流式别把普通转发改坏"）。"""
    original = getattr(app.state, "client", None)
    upstream = _mock_upstream(b'{"ok": true}', content_type="application/json", hanging=False)
    server, serve, port = await _serve()
    try:
        app.state.client = upstream
        async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}", timeout=10) as client:
            response = await client.get("/api/v1/agent-team/runs/r1")
        assert response.status_code == 200
        assert response.json() == {"ok": True}
    finally:
        await _shut_down(server, serve)
        await upstream.aclose()
        if original is not None:
            app.state.client = original
