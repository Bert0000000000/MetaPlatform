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
from app.code.repository import (  # noqa: E402
    CodeShareRepository,
    CodeSnippetRepository,
    CodeTemplateRepository,
)
from app.code.service import CodeService  # noqa: E402
from app.common.api_response import build_page  # noqa: E402
from app.common.jwt_auth import create_token  # noqa: E402
from app.deps import get_registry, set_registry  # noqa: E402
from app.embeddings.client import MockEmbeddingClient  # noqa: E402
from app.embeddings.service import EmbeddingService  # noqa: E402
from app.models.repository import ModelRepository  # noqa: E402
from app.models.service import ModelService  # noqa: E402
from app.prompts.repository import PromptRepository  # noqa: E402
from app.prompts.service import PromptService  # noqa: E402
from app.quotas.repository import QuotaRepository  # noqa: E402
from app.quotas.service import QuotaService  # noqa: E402
from app.ratelimits.runtime import RateLimitGuard  # noqa: E402
from app.cost.repository import UsageRepository  # noqa: E402
from app.cost.service import CostReportService  # noqa: E402
from app.audit.repository import AuditLogRepository  # noqa: E402
from app.audit.service import AuditLogService  # noqa: E402
from app.ratelimits.repository import RateLimitRepository  # noqa: E402
from app.ratelimits.service import RateLimitService  # noqa: E402
from app.routing.repository import RoutingRuleRepository  # noqa: E402
from app.routing.service import ModelRoutingOptimizer  # noqa: E402
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
    prompt_repo = PromptRepository()
    prompt_service = PromptService(prompt_repo, chat_service)
    quota_repo = QuotaRepository()
    quota_service = QuotaService(quota_repo)
    usage_repo = UsageRepository()
    cost_service = CostReportService(usage_repo)
    audit_repo = AuditLogRepository()
    audit_service = AuditLogService(audit_repo)
    rate_limit_repo = RateLimitRepository()
    rate_limit_service = RateLimitService(rate_limit_repo)
    rate_limit_service._guard = RateLimitGuard(rate_limit_service)

    routing_repo = RoutingRuleRepository()
    routing_service = ModelRoutingOptimizer(model_service, cost_service, routing_repo)

    # Code module (V12-02)
    template_repo = CodeTemplateRepository()
    snippet_repo = CodeSnippetRepository()
    share_repo = CodeShareRepository()
    code_service = CodeService(
        chat_service=chat_service,
        template_repo=template_repo,
        snippet_repo=snippet_repo,
        share_repo=share_repo,
    )

    from app.deps import Registry

    reg = Registry(
        model_repo=repo,
        model_service=model_service,
        provider_client=provider_client,
        chat_service=chat_service,
        embedding_client=embedding_client,
        embedding_service=embedding_service,
        prompt_repo=prompt_repo,
        prompt_service=prompt_service,
        quota_repo=quota_repo,
        quota_service=quota_service,
        rate_limit_repo=rate_limit_repo,
        rate_limit_service=rate_limit_service,
        usage_repo=usage_repo,
        cost_service=cost_service,
        audit_repo=audit_repo,
        audit_service=audit_service,
        template_repo=template_repo,
        snippet_repo=snippet_repo,
        share_repo=share_repo,
        code_service=code_service,
        routing_repo=routing_repo,
        routing_service=routing_service,
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
async def seeded_models(registry):
    """Sync the full catalog so most tests start from a populated repo."""

    await registry.model_service.sync(TEST_TENANT)
    return registry
