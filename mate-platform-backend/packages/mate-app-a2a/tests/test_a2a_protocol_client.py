"""W1 tests: ExternalAgentClient now speaks A2A via the official a2a-sdk.

The outbound transport is swapped from the hand-rolled HTTP JSON POST
to the official SDK client. These tests inject a fake A2A client
factory and verify:
  - a valid SDK response is extracted into {text, artifacts, task_id, state}
  - the A2A message text reaches the SDK client
  - timeout / HTTP errors propagate so the delegator maps them
"""
from __future__ import annotations

import types

import httpx
import pytest
from mate_app_a2a.clients import ExternalAgentClient


def _fake_chunk(*, task_id: str = "task-1", state: int = 3, text: str = "result text"):
    """Build a StreamResponse-like chunk carrying a minimal Task."""
    artifact = types.SimpleNamespace(
        name="response",
        parts=[
            types.SimpleNamespace(text=text, filename="out.txt", media_type="text/plain"),
            types.SimpleNamespace(text="", filename="", media_type=""),
        ],
    )
    task = types.SimpleNamespace(
        id=task_id,
        status=types.SimpleNamespace(state=state),
        artifacts=[artifact],
    )
    return types.SimpleNamespace(task=task)


def _make_client(factory_responses=None, *, raise_exc: Exception | None = None):
    """Build an ExternalAgentClient with a fake SDK client factory."""
    calls: list[str] = []

    class FakeA2AClient:
        def __init__(self, chunks):
            self._chunks = chunks

        async def send_message(self, request):
            for chunk in self._chunks:
                yield chunk

        async def close(self):
            return None

    async def factory(endpoint: str):
        calls.append(endpoint)
        if raise_exc is not None:
            raise raise_exc
        return FakeA2AClient(factory_responses or [_fake_chunk()])

    client = ExternalAgentClient(client_factory=factory)
    client._calls = calls  # type: ignore[attr-defined]
    return client


@pytest.mark.asyncio
async def test_call_extracts_sdk_task() -> None:
    client = _make_client([_fake_chunk(task_id="task-x", text="hello result")])
    result = await client.call(
        endpoint="https://agent.example.com",
        payload={"message": "summarize", "context": {"doc": "1"}},
        tenant_id="tenant-acme",
        trace_id="trace-1",
    )
    assert result["task_id"] == "task-x"
    assert result["text"] == "hello result"
    assert result["state"] == "TASK_STATE_COMPLETED"
    assert result["artifacts"][0]["name"] == "response"
    assert result["artifacts"][0]["parts"][0] == {
        "text": "hello result",
        "filename": "out.txt",
        "media_type": "text/plain",
    }
    assert client._calls == ["https://agent.example.com"]  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_call_sends_message_text_to_sdk() -> None:
    captured: list[dict] = []

    class CapturingClient:
        async def send_message(self, request):
            captured.append({"text": request.message.parts[0].text})
            yield _fake_chunk()

        async def close(self):
            return None

    async def factory(endpoint: str):
        return CapturingClient()

    client = ExternalAgentClient(client_factory=factory)
    await client.call(
        endpoint="https://agent.example.com",
        payload={"message": "hello world", "context": {}},
        tenant_id="t",
    )
    assert captured == [{"text": "hello world"}]


@pytest.mark.asyncio
async def test_call_empty_message_raises() -> None:
    client = _make_client()
    with pytest.raises(httpx.HTTPError):
        await client.call(
            endpoint="https://agent.example.com",
            payload={"message": "", "context": {}},
            tenant_id="t",
        )


@pytest.mark.asyncio
async def test_call_timeout_propagates() -> None:
    client = _make_client(raise_exc=httpx.TimeoutException("boom"))
    with pytest.raises(httpx.TimeoutException):
        await client.call(
            endpoint="https://agent.example.com",
            payload={"message": "hi", "context": {}},
            tenant_id="t",
        )


@pytest.mark.asyncio
async def test_call_client_factory_error_maps_to_http_error() -> None:
    client = _make_client(raise_exc=RuntimeError("no agent card"))

    with pytest.raises(httpx.HTTPError):
        await client.call(
            endpoint="https://agent.example.com",
            payload={"message": "hi", "context": {}},
            tenant_id="t",
        )
