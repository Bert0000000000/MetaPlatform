"""Tests for the OpenAI-compatible /chat/completions wrapper."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.common.errors import ErrorCode


def _seed_chat_model(service) -> None:
    from app.models.schemas import Model, ModelCapability, ModelType

    service._repo.upsert_sync(  # type: ignore[attr-defined]
        Model(
            model_id="m-openai-gpt-4o-mini",
            tenant_id="tenant-test",
            provider="OPENAI",
            model_code="gpt-4o-mini",
            display_name="GPT-4o mini",
            type=ModelType.MULTIMODAL,
            capabilities=[
                ModelCapability.CHAT.value,
                ModelCapability.FUNCTION_CALLING.value,
                ModelCapability.VISION.value,
            ],
            enabled=True,
        )
    )


def test_chat_completions_returns_openai_envelope(
    client: TestClient,
    seeded_models,
    tenant_headers,
) -> None:
    _seed_chat_model(seeded_models.model_service)
    body = {
        "model": "m-openai-gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are helpful."},
            {"role": "user", "content": "Hello"},
        ],
        "temperature": 0.1,
        "max_tokens": 32,
    }
    resp = client.post("/api/v1/llmgw/chat/completions", json=body, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    payload = resp.json()["data"]
    assert payload["model"] == "m-openai-gpt-4o-mini"
    assert payload["provider"] == "OPENAI"
    assert payload["choices"][0]["message"]["role"] == "assistant"
    assert isinstance(payload["choices"][0]["message"]["content"], str)
    assert payload["usage"]["totalTokens"] > 0


def test_chat_completions_rejects_empty_messages(
    client: TestClient,
    tenant_headers,
) -> None:
    body = {
        "model": "m-openai-gpt-4o-mini",
        "messages": [],
    }
    resp = client.post("/api/v1/llmgw/chat/completions", json=body, headers=tenant_headers)
    # Pydantic validation: messages must have at least 1 element.
    assert resp.status_code == 400


def test_chat_completions_returns_404_when_model_missing(
    client: TestClient,
    tenant_headers,
) -> None:
    body = {
        "model": "m-does-not-exist",
        "messages": [{"role": "user", "content": "hi"}],
    }
    resp = client.post("/api/v1/llmgw/chat/completions", json=body, headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.MODEL_NOT_FOUND)


def test_chat_completions_auto_route(
    client: TestClient,
    seeded_models,
    tenant_headers,
) -> None:
    body = {
        "messages": [{"role": "user", "content": "Hello"}],
        "autoRoute": True,
        "strategy": "cheapest",
        "max_tokens": 32,
    }
    resp = client.post("/api/v1/llmgw/chat/completions", json=body, headers=tenant_headers)
    assert resp.status_code == 200, resp.text
    payload = resp.json()["data"]
    assert payload["autoRouted"] is True
    assert payload["recommendedModelId"]
    assert payload["model"] == payload["recommendedModelId"]
    assert payload["choices"][0]["message"]["role"] == "assistant"


def test_chat_completions_requires_model_or_auto_route(
    client: TestClient,
    tenant_headers,
) -> None:
    body = {
        "messages": [{"role": "user", "content": "Hello"}],
    }
    resp = client.post("/api/v1/llmgw/chat/completions", json=body, headers=tenant_headers)
    assert resp.status_code == 400
