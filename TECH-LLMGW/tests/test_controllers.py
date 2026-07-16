"""HTTP-level tests for the Phase 2 controllers (WebMvcTest equivalent)."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from app.common.errors import ErrorCode


# -------------------------------------------------------------- /models/sync


def test_sync_endpoint_returns_envelope(client: TestClient, tenant_headers):
    resp = client.post(
        "/api/v1/llmgw/models/sync",
        json={"providers": ["OPENAI", "VOLCENGINE"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == tenant_headers["X-Trace-Id"]
    data = body["data"]
    assert data["total"] >= 2
    provider_names = {p["provider"] for p in data["providers"]}
    assert provider_names == {"OPENAI", "VOLCENGINE"}


def test_sync_endpoint_rejects_unknown_provider(client: TestClient, tenant_headers):
    resp = client.post(
        "/api/v1/llmgw/models/sync",
        json={"providers": ["BOGUS"]},
        headers=tenant_headers,
    )
    assert resp.status_code == 404
    body = resp.json()
    assert body["code"] == int(ErrorCode.PROVIDER_NOT_FOUND)
    assert body["data"]["unknownProviders"] == ["BOGUS"]


# --------------------------------------------------------------- /models GET


def test_list_models_filters(client: TestClient, tenant_headers, seeded_models):
    # All enabled
    resp = client.get("/api/v1/llmgw/models", headers=tenant_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["pageSize"] == 20
    assert body["data"]["total"] >= 9  # full catalog has 9 entries

    # Provider filter
    resp = client.get(
        "/api/v1/llmgw/models",
        params={"provider": "OPENAI", "type": "MULTIMODAL"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert items
    for item in items:
        assert item["provider"] == "OPENAI"
        assert item["type"] == "MULTIMODAL"


def test_list_models_invalid_type(client: TestClient, tenant_headers, seeded_models):
    resp = client.get(
        "/api/v1/llmgw/models",
        params={"type": "WHATEVER"},
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


def test_model_detail_404(client: TestClient, tenant_headers, seeded_models):
    resp = client.get(
        "/api/v1/llmgw/models/m-does-not-exist",
        headers=tenant_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.MODEL_NOT_FOUND)


def test_model_detail_ok(client: TestClient, tenant_headers, seeded_models):
    resp = client.get(
        "/api/v1/llmgw/models/m-openai-gpt-4o",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["modelCode"] == "gpt-4o"
    assert "VISION" in data["capabilities"]


def test_multimodal_models_endpoint(client: TestClient, tenant_headers, seeded_models):
    resp = client.get("/api/v1/llmgw/models/multimodal", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert items
    assert all(item["type"] == "MULTIMODAL" for item in items)


def test_embedding_models_endpoint(client: TestClient, tenant_headers, seeded_models):
    resp = client.get("/api/v1/llmgw/models/embedding", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert items
    assert all(item["type"] == "EMBEDDING" for item in items)


def test_global_models_endpoint(client: TestClient, tenant_headers, seeded_models):
    resp = client.get("/api/v1/llmgw/models/global", headers=tenant_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    # tenant + public; we expect at least 2x the catalog.
    assert len(items) >= 9


# ------------------------------------------------------------ /chat/multimodal


def test_multimodal_chat_endpoint(client: TestClient, tenant_headers, seeded_models):
    body = {
        "modelId": "m-openai-gpt-4o",
        "text": "describe",
        "images": [{"url": "https://example.com/x.png", "detail": "auto"}],
        "temperature": 0.2,
        "maxTokens": 128,
    }
    resp = client.post(
        "/api/v1/llmgw/chat/multimodal",
        json=body,
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["provider"] == "OPENAI"
    assert data["model"] == "gpt-4o"
    assert "usage" in data


def test_multimodal_chat_rejects_non_vision_model(
    client: TestClient, tenant_headers, seeded_models
):
    body = {
        "modelId": "m-volcengine-doubao-pro-32k",  # CHAT only
        "text": "describe",
        "images": [{"url": "https://example.com/x.png"}],
    }
    resp = client.post(
        "/api/v1/llmgw/chat/multimodal",
        json=body,
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.UNSUPPORTED_MODALITY)


def test_multimodal_chat_image_validation(
    client: TestClient, tenant_headers, seeded_models
):
    # Both url & base64
    body = {
        "modelId": "m-openai-gpt-4o",
        "text": "describe",
        "images": [{"url": "https://example.com/x.png", "base64": "x"}],
    }
    resp = client.post(
        "/api/v1/llmgw/chat/multimodal",
        json=body,
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


def test_multimodal_upload_endpoint(client: TestClient, tenant_headers, seeded_models):
    # Tiny 1x1 PNG (base64-decoded bytes are 67 bytes total)
    png_bytes = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108020000009077533DE"
        "00000000C49444154789C636060606000000005000158A38F0D0000000049454E44AE426082"
    )
    files = [
        ("image", ("cat.png", io.BytesIO(png_bytes), "image/png")),
    ]
    data = {
        "modelId": "m-openai-gpt-4o",
        "text": "describe",
        "temperature": "0.1",
        "maxTokens": "64",
    }
    resp = client.post(
        "/api/v1/llmgw/chat/multimodal/upload",
        files=files,
        data=data,
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()["data"]
    assert payload["provider"] == "OPENAI"


def test_multimodal_upload_rejects_bad_mime(
    client: TestClient, tenant_headers, seeded_models
):
    files = [
        ("image", ("notes.txt", io.BytesIO(b"hello"), "text/plain")),
    ]
    data = {"modelId": "m-openai-gpt-4o", "text": "describe"}
    resp = client.post(
        "/api/v1/llmgw/chat/multimodal/upload",
        files=files,
        data=data,
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_FIELD_VALUE)


# --------------------------------------------------------- /embeddings/batch


def test_embedding_batch_endpoint(client: TestClient, tenant_headers, seeded_models):
    body = {
        "modelId": "m-volcengine-doubao-embedding-large",
        "inputs": ["alpha", "beta", "gamma"],
        "normalize": True,
    }
    resp = client.post(
        "/api/v1/llmgw/embeddings/batch",
        json=body,
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["provider"] == "VOLCENGINE"
    assert data["model"] == "doubao-embedding-large"
    assert data["dimension"] == 16
    assert len(data["embeddings"]) == 3
    # L2-normalized
    for vec in data["embeddings"]:
        norm = sum(x * x for x in vec) ** 0.5
        assert abs(norm - 1.0) < 1e-6


def test_embedding_batch_rejects_wrong_type(
    client: TestClient, tenant_headers, seeded_models
):
    body = {"modelId": "m-openai-gpt-4o", "inputs": ["x"]}
    resp = client.post(
        "/api/v1/llmgw/embeddings/batch",
        json=body,
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.UNSUPPORTED_MODEL_TYPE)


def test_embedding_batch_rejects_too_many(
    client: TestClient, tenant_headers, seeded_models
):
    body = {
        "modelId": "m-volcengine-doubao-embedding-large",
        "inputs": [f"t{i}" for i in range(101)],
    }
    resp = client.post(
        "/api/v1/llmgw/embeddings/batch",
        json=body,
        headers=tenant_headers,
    )
    # Pydantic validation -> 400 with INVALID_PARAM
    assert resp.status_code == 400


# --------------------------------------------------------------------- meta


def test_api_envelope_on_error(client: TestClient, tenant_headers):
    resp = client.get(
        "/api/v1/llmgw/models/m-does-not-exist",
        headers=tenant_headers,
    )
    body = resp.json()
    assert set(body.keys()) >= {"code", "message", "data", "traceId"}
    assert body["code"] != 0


def test_health_endpoint(client: TestClient):
    resp = client.get("/api/v1/llmgw/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}