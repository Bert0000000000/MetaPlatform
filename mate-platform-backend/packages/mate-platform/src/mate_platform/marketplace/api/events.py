"""SSE 安装事件通道。

`/install/{install_id}/events` — 流式订阅 orchestrator publish 的状态变更。
"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

router = APIRouter(tags=["marketplace"])


def installer_to_sse_payload(
    install_id: Any, state: str, **extra: Any
) -> str:
    """把 state transition 编码为 SSE 消息字符串。"""
    data = {"install_id": str(install_id), "state": state, **extra}
    return (
        "event: marketplace.install.state\n"
        f"data: {json.dumps(data)}\n\n"
    )


async def install_event_stream(
    install_id: Any, *, pubsub: Any
) -> AsyncIterator[str]:
    """Generator:订阅 Redis pubsub `marketplace.install.<id>.events` 直到断开。

    用法:SSE 路由内调用本 generator,FastAPI 包装为 EventSourceResponse。

    pubsub 协议:可选 ``subscribe(channel)`` 方法(返回异步迭代器);
    若无该方法,直接迭代 pubsub 本身。
    """
    if hasattr(pubsub, "subscribe"):
        sub = await pubsub.subscribe(
            f"marketplace.install.{install_id}.events"
        )
    else:
        sub = pubsub
    try:
        async for msg in sub:
            data = msg.get("data") if isinstance(msg, dict) else msg
            if isinstance(data, bytes):
                data = data.decode("utf-8")
            yield data
    finally:
        if hasattr(sub, "close"):
            try:
                await sub.close()
            except Exception:  # noqa: BLE001
                pass


@router.get("/install/{install_id}/events")
async def stream_install_events(install_id: str, request: Request):
    redis = getattr(request.state, "redis", None)
    if redis is None:
        # 没有 pubsub,直接 503 — 上层会启用轮询 fallback
        from fastapi import HTTPException, status as _status

        raise HTTPException(
            status_code=_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "MP_PUBSUB_UNAVAILABLE",
                "message": "redis pubsub 未启用",
            },
        )

    async def event_gen() -> AsyncIterator[str]:
        async for msg in install_event_stream(
            install_id, pubsub=redis
        ):
            yield msg

    return EventSourceResponse(event_gen())