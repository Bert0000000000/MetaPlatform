"""聊天模型选择与后台 AI Provider 配置对齐（/models/chat + 模型解析）。

覆盖：
- ``_resolve_chat_model``：显式选择优先；遗留占位符/缺省回退 default_model
- ``GET /api/v1/copilot/models/chat``：IAM 注册表条目映射、disabled 过滤、
  default_model 补入、注册表不可用回退遗留默认
"""

from __future__ import annotations

import time
from typing import Any

import jwt as pyjwt
from fastapi.testclient import TestClient

from mate_app_copilot.api.app import _LEGACY_DEFAULT_MODEL, _resolve_chat_model
from mate_app_copilot.clients.base import AsyncCopilotClient

_REGISTRY: list[dict[str, Any]] = [
    {"id": 1, "provider": "ark", "model_id": "glm-5.3-flash", "display_name": "GLM 5.3 Flash", "modality": "text", "enabled": True},
    {"id": 2, "provider": "ark", "model_id": "glm-5.3-air", "display_name": None, "modality": "text", "enabled": True},
    {"id": 3, "provider": "ollama", "model_id": "llama3.2:latest", "display_name": None, "modality": "text", "enabled": False},
]

_PROVIDER_CFG: dict[str, str] = {
    "provider_id": "ark",
    "base_url": "https://ark.cn-beijing.volces.com/api/plan/v3",
    "api_key": "sk-test",
    "default_model": "glm-5.3-flash",
}


class _FakeClient(AsyncCopilotClient):
    """覆盖 list_ai_models / get_provider_config 的假 client。"""

    def __init__(self, *, registry: list[dict[str, Any]] | None = None, provider_cfg: dict[str, str] | None = None, fail: bool = False):
        super().__init__(
            base_url="http://gateway.test:8100",
            auth=_dummy_auth(),
            provider=__import__("mate_app_copilot.llm.stub_provider", fromlist=["x"]),
        )
        self._registry = registry if registry is not None else list(_REGISTRY)
        self._provider_cfg = provider_cfg if provider_cfg is not None else dict(_PROVIDER_CFG)
        self._fail = fail

    async def list_ai_models(self, tenant_id, fallback_token=None) -> list[dict[str, Any]]:
        if self._fail:
            raise RuntimeError("iam unavailable")
        return [dict(i) for i in self._registry]

    async def get_provider_config(self, tenant_id, provider_id, fallback_token=None) -> dict[str, str]:
        if self._fail:
            raise RuntimeError("iam unavailable")
        return dict(self._provider_cfg)


def _dummy_auth():
    from mate_clients.security.bearer import BearerAuth

    return BearerAuth(
        token_uri="http://localhost:8080/realms/metaplatform/protocol/openid-connect/token",
        client_id="metaplatform-backend",
        client_secret="stub",
        scope="platform.read platform.write",
    )


def _auth_headers() -> dict[str, str]:
    now = int(time.time())
    token = pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "alice",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": ["tenant-acme"]},
            "tenant_id": "tenant-acme",
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        "test-secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def _make_client(fake: _FakeClient) -> TestClient:
    from mate_app_copilot.main import create_app
    from mate_app_copilot.repositories import in_memory as in_memory_repo

    in_memory_repo.reset_store()
    app = create_app()
    app.state.outbox_writer = __import__(
        "mate_platform.messaging.outbox", fromlist=["InMemoryOutboxWriter"]
    ).InMemoryOutboxWriter()
    app.state.copilot_client = fake
    return TestClient(app)


class TestResolveChatModel:
    def test_explicit_selection_wins(self):
        assert _resolve_chat_model("glm-5.3-air", _PROVIDER_CFG) == "glm-5.3-air"

    def test_legacy_placeholder_falls_back_to_default(self):
        assert _resolve_chat_model(_LEGACY_DEFAULT_MODEL, _PROVIDER_CFG) == "glm-5.3-flash"

    def test_missing_falls_back_to_default(self):
        assert _resolve_chat_model(None, _PROVIDER_CFG) == "glm-5.3-flash"
        assert _resolve_chat_model("", _PROVIDER_CFG) == "glm-5.3-flash"

    def test_placeholder_without_default_keeps_placeholder(self):
        assert _resolve_chat_model(_LEGACY_DEFAULT_MODEL, {}) == _LEGACY_DEFAULT_MODEL

    def test_missing_without_default_uses_legacy(self):
        assert _resolve_chat_model(None, {}) == _LEGACY_DEFAULT_MODEL


class TestChatModelsEndpoint:
    def test_registry_items_with_default(self):
        with _make_client(_FakeClient()) as c:
            r = c.get("/api/v1/copilot/models/chat", headers=_auth_headers())
        assert r.status_code == 200
        body = r.json()
        ids = [i["modelId"] for i in body["items"]]
        # disabled 条目被过滤；default_model 不重复补入
        assert ids == ["glm-5.3-flash", "glm-5.3-air"]
        assert body["default_model"] == "glm-5.3-flash"
        assert body["provider"] == "ark"
        assert body["total"] == 2

    def test_default_not_in_registry_is_prepended(self):
        cfg = dict(_PROVIDER_CFG, default_model="glm-5.5")
        with _make_client(_FakeClient(provider_cfg=cfg)) as c:
            r = c.get("/api/v1/copilot/models/chat", headers=_auth_headers())
        body = r.json()
        assert [i["modelId"] for i in body["items"]] == ["glm-5.5", "glm-5.3-flash", "glm-5.3-air"]
        assert body["default_model"] == "glm-5.5"

    def test_empty_registry_falls_back_to_legacy_default(self):
        with _make_client(_FakeClient(registry=[])) as c:
            r = c.get("/api/v1/copilot/models/chat", headers=_auth_headers())
        body = r.json()
        # 注册表空 → 遗留默认兜底；default_model 仍补入保证可选
        assert [i["modelId"] for i in body["items"]] == ["glm-5.3-flash", _LEGACY_DEFAULT_MODEL]
        assert body["default_model"] == "glm-5.3-flash"

    def test_iam_unavailable_falls_back(self):
        with _make_client(_FakeClient(fail=True)) as c:
            r = c.get("/api/v1/copilot/models/chat", headers=_auth_headers())
        assert r.status_code == 200
        body = r.json()
        assert [i["modelId"] for i in body["items"]] == [_LEGACY_DEFAULT_MODEL]
        assert body["default_model"] == ""
