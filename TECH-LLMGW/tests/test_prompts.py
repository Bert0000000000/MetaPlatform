"""Prompt template API tests (P1-LLMGW-03)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.common.errors import ErrorCode


PROMPT_PAYLOAD = {
    "promptKey": "test-qa",
    "name": "Test QA Prompt",
    "description": "A test prompt",
    "category": "test",
    "template": "Context: {{context}}\nQuestion: {{question}}",
    "variables": [
        {"name": "context", "type": "string", "required": True},
        {"name": "question", "type": "string", "required": True},
    ],
    "tags": ["test", "qa"],
}


def _create_prompt(client: TestClient, headers: dict) -> str:
    resp = client.post("/api/v1/llmgw/prompts", json=PROMPT_PAYLOAD, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["promptId"]


# ------------------------------------------------------------------- create


def test_create_prompt_success(client: TestClient, tenant_headers):
    resp = client.post(
        "/api/v1/llmgw/prompts", json=PROMPT_PAYLOAD, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["promptKey"] == "test-qa"
    assert data["name"] == "Test QA Prompt"
    assert data["version"] == 1
    assert data["status"] == "ACTIVE"
    assert len(data["variables"]) == 2


def test_create_prompt_rejects_duplicate_key(client: TestClient, tenant_headers):
    _create_prompt(client, tenant_headers)
    resp = client.post(
        "/api/v1/llmgw/prompts", json=PROMPT_PAYLOAD, headers=tenant_headers
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == int(ErrorCode.PROMPT_KEY_EXISTS)


def test_create_prompt_rejects_undefined_variable(
    client: TestClient, tenant_headers
):
    payload = {
        "promptKey": "bad-var",
        "name": "Bad Var Prompt",
        "template": "Hello {{name}} and {{undefined_var}}",
        "variables": [{"name": "name", "type": "string"}],
    }
    resp = client.post("/api/v1/llmgw/prompts", json=payload, headers=tenant_headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)


# -------------------------------------------------------------------- list


def test_list_prompts_paging(client: TestClient, tenant_headers):
    _create_prompt(client, tenant_headers)
    resp = client.get("/api/v1/llmgw/prompts", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["page"] == 1
    assert data["pageSize"] == 20
    assert data["total"] >= 1
    assert any(item["promptKey"] == "test-qa" for item in data["items"])


def test_list_prompts_filters(client: TestClient, tenant_headers):
    _create_prompt(client, tenant_headers)
    resp = client.get(
        "/api/v1/llmgw/prompts",
        params={"category": "test", "tags": "test,qa", "keyword": "QA"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert all(item["category"] == "test" for item in items)
    assert any(item["promptKey"] == "test-qa" for item in items)


# ------------------------------------------------------------------ detail


def test_get_prompt_detail(client: TestClient, tenant_headers):
    prompt_id = _create_prompt(client, tenant_headers)
    resp = client.get(f"/api/v1/llmgw/prompts/{prompt_id}", headers=tenant_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["promptId"] == prompt_id
    assert "template" in data


def test_get_prompt_detail_404(client: TestClient, tenant_headers):
    resp = client.get("/api/v1/llmgw/prompts/prm-does-not-exist", headers=tenant_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == int(ErrorCode.PROMPT_NOT_FOUND)


# ------------------------------------------------------------------ update


def test_update_prompt_creates_new_version(client: TestClient, tenant_headers):
    prompt_id = _create_prompt(client, tenant_headers)
    update = {
        "template": "Context: {{context}}\nQuestion: {{question}}\nAnswer in Chinese.",
        "changeLog": "Add Chinese requirement",
    }
    resp = client.put(
        f"/api/v1/llmgw/prompts/{prompt_id}", json=update, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["version"] == 2
    assert data["previousVersion"] == 1
    assert data["changeLog"] == "Add Chinese requirement"


def test_update_prompt_auto_creates_new_variable(
    client: TestClient, tenant_headers
):
    prompt_id = _create_prompt(client, tenant_headers)
    update = {"template": "Context: {{context}}\nQuestion: {{question}}\nExtra: {{new_var}}"}
    resp = client.put(
        f"/api/v1/llmgw/prompts/{prompt_id}", json=update, headers=tenant_headers
    )
    assert resp.status_code == 200, resp.text
    detail = client.get(
        f"/api/v1/llmgw/prompts/{prompt_id}", headers=tenant_headers
    ).json()["data"]
    var_names = {v["name"] for v in detail["variables"]}
    assert "new_var" in var_names


# ------------------------------------------------------------------ delete


def test_delete_prompt(client: TestClient, tenant_headers):
    prompt_id = _create_prompt(client, tenant_headers)
    resp = client.delete(
        f"/api/v1/llmgw/prompts/{prompt_id}", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["deleted"] is True
    assert data["deletedVersions"] == 1

    resp = client.get(f"/api/v1/llmgw/prompts/{prompt_id}", headers=tenant_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------- versions


def test_list_versions(client: TestClient, tenant_headers):
    prompt_id = _create_prompt(client, tenant_headers)
    client.put(
        f"/api/v1/llmgw/prompts/{prompt_id}",
        json={"name": "Updated Name", "changeLog": "Rename"},
        headers=tenant_headers,
    )

    resp = client.get(
        f"/api/v1/llmgw/prompts/{prompt_id}/versions", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    versions = [v["version"] for v in data["items"]]
    assert versions == [2, 1]


def test_get_specific_version(client: TestClient, tenant_headers):
    prompt_id = _create_prompt(client, tenant_headers)
    client.put(
        f"/api/v1/llmgw/prompts/{prompt_id}",
        json={"name": "Updated Name", "changeLog": "Rename"},
        headers=tenant_headers,
    )

    resp = client.get(
        f"/api/v1/llmgw/prompts/{prompt_id}/versions/1", headers=tenant_headers
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["version"] == 1
    assert data["name"] == "Test QA Prompt"


# ----------------------------------------------------------------- rollback


def test_rollback_prompt(client: TestClient, tenant_headers):
    prompt_id = _create_prompt(client, tenant_headers)
    client.put(
        f"/api/v1/llmgw/prompts/{prompt_id}",
        json={"name": "Updated Name", "changeLog": "Rename"},
        headers=tenant_headers,
    )

    resp = client.post(
        f"/api/v1/llmgw/prompts/{prompt_id}/rollback",
        json={"targetVersion": 1, "changeLog": "Rollback to v1"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["version"] == 3
    assert data["rolledBackFrom"] == 2
    assert data["rolledBackTo"] == 1

    detail = client.get(
        f"/api/v1/llmgw/prompts/{prompt_id}", headers=tenant_headers
    ).json()["data"]
    assert detail["version"] == 3
    assert detail["name"] == "Test QA Prompt"


# ------------------------------------------------------------------ render


def test_render_prompt(client: TestClient, tenant_headers):
    prompt_id = _create_prompt(client, tenant_headers)
    variables = {"context": "Some context", "question": "What is this?"}
    resp = client.post(
        f"/api/v1/llmgw/prompts/{prompt_id}/render",
        json={"variables": variables},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["renderedPrompt"] == "Context: Some context\nQuestion: What is this?"
    assert sorted(data["replacedVariables"]) == ["context", "question"]
    assert data["missingVariables"] == []


def test_render_prompt_missing_required_variable(
    client: TestClient, tenant_headers
):
    prompt_id = _create_prompt(client, tenant_headers)
    resp = client.post(
        f"/api/v1/llmgw/prompts/{prompt_id}/render",
        json={"variables": {"context": "Only context"}},
        headers=tenant_headers,
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == int(ErrorCode.PROMPT_VARIABLE_MISSING)
    assert "question" in body["data"]["missingVariables"]


# ------------------------------------------------------------------ preview


def test_preview_prompt(client: TestClient, tenant_headers, seeded_models):
    payload = {
        **PROMPT_PAYLOAD,
        "promptKey": "test-preview",
        "defaultModel": "m-openai-gpt-4o",
    }
    resp = client.post("/api/v1/llmgw/prompts", json=payload, headers=tenant_headers)
    prompt_id = resp.json()["data"]["promptId"]

    variables = {"context": "Mate Platform context", "question": "Hello?"}
    resp = client.post(
        f"/api/v1/llmgw/prompts/{prompt_id}/preview",
        json={"variables": variables, "model": "m-openai-gpt-4o"},
        headers=tenant_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["promptId"] == prompt_id
    assert "renderedPrompt" in data
    assert data["model"] == "m-openai-gpt-4o"
    assert "response" in data
    assert "usage" in data


def test_preview_prompt_missing_model(client: TestClient, tenant_headers):
    prompt_id = _create_prompt(client, tenant_headers)
    variables = {"context": "Mate Platform context", "question": "Hello?"}
    resp = client.post(
        f"/api/v1/llmgw/prompts/{prompt_id}/preview",
        json={"variables": variables},
        headers=tenant_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == int(ErrorCode.INVALID_PARAM)
