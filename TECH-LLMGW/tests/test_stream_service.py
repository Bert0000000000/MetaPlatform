"""Tests for the streaming chat SSE endpoint (S-LLMGW-04)."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.common.errors import ErrorCode


def _stream_body(
    *,
    model_id: str = "m-openai-gpt-4o",
    text: str = "describe this image",
    images: list[dict] | None = None,
) -> dict:
    if images is None:
        images = [{"url": "https://example.com/x.png", "detail": "auto"}]
    return {
        "modelId": model_id,
        "text": text,
        "images": images,
        "temperature": 0.2,
        "maxTokens": 128,
    }


# ----------------------------------------------------------------- success


def test_stream_chat_success(client: TestClient, tenant_headers, seeded_models):
    """Valid request returns SSE-formatted chunks with a final done frame."""

    resp = client.post(
        "/api/v1/llmgw/chat/stream",
        json=_stream_body(),
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/event-stream")

    # Parse SSE lines.
    lines = [
        line for line in resp.text.split("\n\n") if line.strip()
    ]

    # At least 5 content chunks + 1 final done frame.
    assert len(lines) >= 6

    content_chunks = []
    done_frame = None
    for line in lines:
        assert line.startswith("data: ")
        payload = json.loads(line[len("data: "):])
        if payload.get("done") is False:
            content_chunks.append(payload["content"])
        elif payload.get("done") is True:
            done_frame = payload

    # 5-10 content chunks.
    assert 5 <= len(content_chunks) <= 10

    # Concatenated content should be non-empty.
    full_content = "".join(content_chunks)
    assert full_content  # mock always returns content

    # Done frame has usage stats.
    assert done_frame is not None
    assert done_frame["content"] == ""
    assert "usage" in done_frame
    assert done_frame["usage"]["promptTokens"] > 0
    assert done_frame["usage"]["completionTokens"] > 0


# ------------------------------------------------------------- 404 model


def test_stream_chat_model_not_found(client: TestClient, tenant_headers, seeded_models):
    """Non-existent modelId returns 404 via the global exception handler."""

    resp = client.post(
        "/api/v1/llmgw/chat/stream",
        json=_stream_body(model_id="m-does-not-exist"),
        headers=tenant_headers,
    )
    assert resp.status_code == 404
    body = resp.json()
    assert body["code"] == int(ErrorCode.MODEL_NOT_FOUND)


# ------------------------------------------------------------- 422 empty


def test_stream_chat_empty_text_returns_422(
    client: TestClient, tenant_headers, seeded_models
):
    """Empty ``text`` triggers InvalidRequestError -> HTTP 422."""

    resp = client.post(
        "/api/v1/llmgw/chat/stream",
        json=_stream_body(text=""),
        headers=tenant_headers,
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == int(ErrorCode.INVALID_REQUEST)
