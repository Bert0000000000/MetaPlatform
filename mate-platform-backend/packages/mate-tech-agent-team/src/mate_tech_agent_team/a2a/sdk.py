"""真传输面：官方 ``a2a-sdk`` 1.1.x 客户端（agent card 发现 + ``message/send``）。

**这是唯一 import a2a-sdk 的地方**——SDK 待在 adapter 之后（ADR-0066 R10）。
``.outbound`` 与 ``.sdk`` 的关系是：前者定义**本仓**契约，后者把它翻译成 A2A 线
协议。测试注入替身时完全不需要 a2a-sdk 在场。

对齐既有的 ``mate-app-a2a/clients.py``（同一条出站路径的另一个服务侧实现）：
``create_client(agent=<url>)`` 走 ``/.well-known/agent-card.json`` 发现 agent card，
再按 card 里声明的接口建 JSON-RPC 客户端；``send_message`` 是异步流，取最后那个
携带 ``task`` 的 chunk 就是终态 Task。

**诚实提醒**：A2A 1.0 的 Task 没有父子、没有深度（ADR-0066 §9-D）；本传输面也
**没有**心跳/长任务轮询——一次 ``send`` 就是一次往返。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from a2a.client import ClientConfig, create_client
from a2a.helpers import new_text_message
from a2a.types import Role, SendMessageRequest, TaskState

from .outbound import A2AOutboundRequest, A2AOutboundResult

#: 异步工厂 ``(endpoint) -> a2a Client``。可注入（测试 / 换协议面实现）。
A2AClientFactory = Callable[[str], Awaitable[Any]]

#: 这些终态表示"这一次没干成"——映射成 ``ok=False`` 而不是假装有产出。
_FAILED_STATES = {"TASK_STATE_FAILED", "TASK_STATE_CANCELED", "TASK_STATE_REJECTED"}


async def default_client_factory(endpoint: str) -> Any:
    """按 endpoint 发现 agent card 并建 A2A 客户端（非流式）。"""
    return await create_client(agent=endpoint, client_config=ClientConfig(streaming=False))


def _state_name(state: Any) -> str:
    """protobuf 枚举 → 稳定名字（``TASK_STATE_COMPLETED`` 这种）。"""
    try:
        return TaskState.Name(state)
    except Exception:
        return str(state)


def _final_task(chunks: list[Any]) -> Any:
    """取异步流里最后一个携带 ``task`` 的 chunk（= 终态 Task）。"""
    for chunk in reversed(chunks):
        task = getattr(chunk, "task", None)
        if task is not None:
            return task
    raise RuntimeError("A2A 响应里没有 task")


def _artifact_text(task: Any) -> str:
    """把每个 artifact 的文本 part 拍平（远端的产物就是这些文本）。"""
    parts: list[str] = []
    for artifact in getattr(task, "artifacts", []) or []:
        for part in getattr(artifact, "parts", []) or []:
            text = getattr(part, "text", "")
            if text:
                parts.append(text)
    return "\n".join(parts)


def _artifact_payloads(task: Any) -> list[dict[str, Any]]:
    """artifact → JSON 友好形态（只取文本/文件名/媒体类型）。"""
    out: list[dict[str, Any]] = []
    for artifact in getattr(task, "artifacts", []) or []:
        entry: dict[str, Any] = {"name": getattr(artifact, "name", ""), "parts": []}
        for part in getattr(artifact, "parts", []) or []:
            payload: dict[str, Any] = {}
            if getattr(part, "text", ""):
                payload["text"] = part.text
            if getattr(part, "filename", ""):
                payload["filename"] = part.filename
            if getattr(part, "media_type", ""):
                payload["media_type"] = part.media_type
            if payload:
                entry["parts"].append(payload)
        out.append(entry)
    return out


class SdkA2ATransport:
    """用官方 SDK 说话的真传输面。"""

    def __init__(self, *, client_factory: A2AClientFactory | None = None) -> None:
        self._client_factory = client_factory or default_client_factory

    async def send(self, *, endpoint: str, request: A2AOutboundRequest) -> A2AOutboundResult:
        client = await self._client_factory(endpoint)
        try:
            message = new_text_message(request.instruction, role=Role.ROLE_USER)
            # 远端 ``a2a-external-agent`` 从 metadata.role_slug 挑 skill；
            # tenant_id 让远端知道这是谁在派活。**不带 depth/parent**（A2A 无此语义）。
            metadata: dict[str, Any] = {"tenant_id": request.tenant_id}
            if request.role_slug:
                metadata["role_slug"] = request.role_slug
            metadata.update(dict(request.context))
            try:
                message.metadata.update(metadata)
            except Exception:
                metadata = {}

            chunks: list[Any] = []
            async for chunk in client.send_message(SendMessageRequest(message=message)):
                chunks.append(chunk)
            task = _final_task(chunks)
            state = _state_name(getattr(getattr(task, "status", None), "state", ""))
            text = _artifact_text(task)
            return A2AOutboundResult(
                task_id=str(getattr(task, "id", "") or ""),
                state=state,
                text=text,
                artifacts=tuple(_artifact_payloads(task)),
                ok=state not in _FAILED_STATES,
                error="" if state not in _FAILED_STATES else f"远端任务终态为 {state}",
            )
        finally:
            close = getattr(client, "close", None)
            if close is not None:
                await close()


__all__ = ["A2AClientFactory", "SdkA2ATransport", "default_client_factory"]
