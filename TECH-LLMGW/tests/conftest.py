"""Pytest fixtures shared by the test suite."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure the repo root (containing ``app/``) is on sys.path regardless of
# how pytest is invoked.
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import pytest  # noqa: E402

from app.chat.provider_client import MockProviderClient  # noqa: E402
from app.chat.service import ChatService  # noqa: E402
from app.common.api_response import build_page  # noqa: E402
from app.common.jwt_auth import create_token  # noqa: E402
from app.deps import get_registry, set_registry  # noqa: E402
from app.embeddings.client import MockEmbeddingClient  # noqa: E402
from app.embeddings.service import EmbeddingService  # noqa: E402
from app.models.repository import ModelRepository  # noqa: E402
from app.models.service import ModelService  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

TEST_TENANT = "tenant-test"


def _make_test_jwt(
    *,
    tenant_id: str = TEST_TENANT,
    user_id: str = "user-test",
    username: str = "test-user",
    expires_in_seconds: int = 3600,
    extra_claims: dict | None = None,
) -> str:
    """Mint a valid HS256 JWT for test requests."""

    claims = {
        "sub": user_id,
        "username": username,
        "tenantId": tenant_id,
        "roles": ["user"],
        "type": "access",
    }
    if extra_claims:
        claims.update(extra_claims)
    return create_token(claims, expires_in_seconds=expires_in_seconds)


@pytest.fixture
def registry():
    """Build a fresh, isolated registry for each test."""

    repo = ModelRepository()
    model_service = ModelService(repo)
    provider_client = MockProviderClient()
    chat_service = ChatService(model_service, provider_client)
    embedding_client = MockEmbeddingClient()
    embedding_service = EmbeddingService(model_service, embedding_client)

    from app.deps import Registry

    reg = Registry(
        model_repo=repo,
        model_service=model_service,
        provider_client=provider_client,
        chat_service=chat_service,
        embedding_client=embedding_client,
        embedding_service=embedding_service,
    )
    set_registry(reg)
    yield reg
    set_registry(None)


@pytest.fixture
def client(registry):
    """FastAPI TestClient with the freshly installed registry."""

    # Ensure the app uses the test registry; set_registry has already run
    # above, so we just point the running app at it.
    app.state.registry = registry
    return TestClient(app)


@pytest.fixture
def tenant_headers():
    token = _make_test_jwt()
    return {
        "X-Tenant-Id": TEST_TENANT,
        "X-Trace-Id": "trace-fixture",
        "Authorization": f"Bearer {token}",
    }


@pytest.fixture
def seeded_models(registry):
    """Sync the full catalog so most tests start from a populated repo."""

    registry.model_service.sync(TEST_TENANT)
    return registry
