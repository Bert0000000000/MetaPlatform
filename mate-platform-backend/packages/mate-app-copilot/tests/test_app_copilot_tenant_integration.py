"""Cross-tenant integration tests for mate-app-copilot (ADR-0014 step 5).

5 tests: wrong-tenant 403, missing-scope pinned, no-tenant non-200,
tenant-isolation ok, a2a delegate proxies to mate-app-a2a.
"""
from __future__ import annotations

import os
import tempfile
import time
from contextlib import suppress
from pathlib import Path

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from mate_app_copilot.main import create_app
from mate_app_copilot.repositories import in_memory as in_memory_repo
from mate_tech_db.base import Base, _state, create_all, init_engine, reset_engine

JWT_SECRET = "test-secret"


def _token(*, tenant_id: str, scopes: str = "platform.read platform.write") -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": scopes,
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def fresh_app() -> TestClient:
    reset_engine()
    fd, db_path = tempfile.mkstemp(suffix=".sqlite", prefix="copilot-tenant-")
    os.close(fd)
    os.environ["MATE_DB_URL"] = f"sqlite:///{db_path}"
    init_engine(os.environ["MATE_DB_URL"])
    create_all()
    in_memory_repo.reset_store()
    app = create_app()
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        if _state.engine is not None:
            Base.metadata.drop_all(_state.engine)
        reset_engine()
        os.environ.pop("MATE_DB_URL", None)
        in_memory_repo.reset_store()
        with suppress(OSError):
            Path(db_path).unlink()


def test_wrong_tenant_403(fresh_app: TestClient) -> None:
    token_a = _token(tenant_id="tenant-acme")
    r = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Tenant-Id": "tenant-globex",
        },
    )
    assert r.status_code == 403, r.text
    assert "tenant" in r.text.lower()


def test_missing_scope_pinned(fresh_app: TestClient) -> None:
    """Step 4 ACL wiring is out of scope for PR#14; pin current behaviour."""
    token = _token(tenant_id="tenant-acme", scopes="")
    r = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text


def test_no_tenant_non_200(fresh_app: TestClient) -> None:
    token = _token(tenant_id="")
    r = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "E_TENANT_REQUIRED"


def test_tenant_isolation_ok(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    r1 = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    r2 = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert all(c["tenant_id"] == "tenant-acme" for c in r1.json()["items"])
    assert all(c["tenant_id"] == "tenant-globex" for c in r2.json()["items"])


def test_cross_tenant_conversation_detail_404(fresh_app: TestClient) -> None:
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    created = fresh_app.post(
        "/api/v1/copilot/conversations",
        json={"title": "globex secret"},
        headers={"Authorization": f"Bearer {token_globex}"},
    )
    assert created.status_code == 200, created.text
    conv_id = created.json()["data"]["id"]

    denied = fresh_app.get(
        f"/api/v1/copilot/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert denied.status_code == 404, denied.text
    assert "globex secret" not in denied.text
    assert "tenant-globex" not in denied.text


def test_conversation_list_fails_closed_when_db_unavailable(
    fresh_app: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from mate_app_copilot.api import app as copilot_app_module

    fallback_called = {"value": False}

    def _fail_session():
        raise RuntimeError("db unavailable")

    def _unexpected_fallback(*args, **kwargs):
        fallback_called["value"] = True
        return []

    monkeypatch.setattr(copilot_app_module, "get_session", _fail_session)
    monkeypatch.setattr(copilot_app_module, "list_conversations", _unexpected_fallback)

    token = _token(tenant_id="tenant-acme")
    resp = fresh_app.get(
        "/api/v1/copilot/conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 500, resp.text
    assert fallback_called["value"] is False


def test_a2a_delegate_proxies_to_a2a(fresh_app: TestClient) -> None:
    """POST /a2a/delegate dispatches via local InMemoryA2AClient (not 501).

    P3-W6 TD-4: the 501 stub was replaced with an in-process
    ``InMemoryA2AClient`` + ``AgentCardRegistry``. The test must
    pre-register the target agent ("agent-rag") in the registry
    before the delegation call — otherwise the handler returns 404
    ``E_AGENT_NOT_FOUND`` (the documented contract).
    """
    from mate_app_copilot.a2a.client import get_default_client
    from mate_app_copilot.a2a.models import AgentCard

    # Reset the default client's registry and register agent-rag
    # for tenant-acme so the delegation can resolve the card.
    client = get_default_client()
    client.registry.reset()
    client.registry.register(
        AgentCard(
            id="agent-rag",
            tenant_id="tenant-acme",
            name="RAG Agent",
            description="Internal RAG retrieval agent",
            endpoint="http://mate-tech-rag:8080/api/v1/rag/search",
            capabilities=("retrieval", "summarization"),
        )
    )

    token = _token(tenant_id="tenant-acme")
    r = fresh_app.post(
        "/api/v1/copilot/a2a/delegate",
        json={
            "target_agent_id": "agent-rag",
            "message": "summarize document",
            "context": {"doc_id": "doc-1"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # InMemoryA2AClient executes synchronously → status is "completed"
    # (not "pending", which was the old create_delegation contract).
    assert body["status"] == "completed", body
    assert body["target_agent_id"] == "agent-rag"
    assert body["id"].startswith("task-")
    # Result payload carries agent card metadata for lineage.
    assert body["result"]["agent_name"] == "RAG Agent"
    assert "tenant_id" in body["lineage_hints"]

    client.registry.reset()


def test_new_get_endpoints_tenant_isolation(fresh_app: TestClient) -> None:
    """P2-W4: /generate/process and /scheduling/templates isolate tenant data.

    Seed data uses fixed ids across tenants (the storage dict is
    per-tenant), so we verify isolation via the ``tenant_id`` field on
    each row rather than id disjointness. ``generate/process`` is a POST
    endpoint (OpenAPI contract), ``scheduling/templates`` a GET one.
    """
    token_acme = _token(tenant_id="tenant-acme")
    token_globex = _token(tenant_id="tenant-globex")

    for path, method, payload in (
        ("generate/process", "POST", {}),
        ("scheduling/templates", "GET", None),
    ):
        if method == "POST":
            r_acme = fresh_app.post(
                f"/api/v1/copilot/{path}",
                json=payload,
                headers={"Authorization": f"Bearer {token_acme}"},
            )
            r_globex = fresh_app.post(
                f"/api/v1/copilot/{path}",
                json=payload,
                headers={"Authorization": f"Bearer {token_globex}"},
            )
        else:
            r_acme = fresh_app.get(
                f"/api/v1/copilot/{path}",
                headers={"Authorization": f"Bearer {token_acme}"},
            )
            r_globex = fresh_app.get(
                f"/api/v1/copilot/{path}",
                headers={"Authorization": f"Bearer {token_globex}"},
            )
        assert r_acme.status_code == 200, (path, r_acme.text)
        assert r_globex.status_code == 200, (path, r_globex.text)
        for item in r_acme.json()["items"]:
            assert item["tenant_id"] == "tenant-acme", (path, item)
        for item in r_globex.json()["items"]:
            assert item["tenant_id"] == "tenant-globex", (path, item)


def test_actions_execute_cross_tenant_scoped(fresh_app: TestClient) -> None:
    """P2-W4: /actions/execute is tenant-scoped.

    Both tenants seed ``act-send-email`` from the same stub catalog, so
    each tenant resolves the action against its own store. The negative
    guarantee (no tenant context → 400) is covered by
    ``test_new_endpoints_no_tenant_400``; here we pin that a valid
    tenant token can execute and an unknown action_id returns 404.
    """
    token_acme = _token(tenant_id="tenant-acme")

    # tenant A can execute its own action
    r_acme = fresh_app.post(
        "/api/v1/copilot/actions/execute",
        json={"action_id": "act-send-email"},
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert r_acme.status_code == 200, r_acme.text
    assert r_acme.json()["action_id"] == "act-send-email"

    # unknown action_id → 404 (no leak of a nonexistent action)
    r_unknown = fresh_app.post(
        "/api/v1/copilot/actions/execute",
        json={"action_id": "act-tenant-acme-private"},
        headers={"Authorization": f"Bearer {token_acme}"},
    )
    assert r_unknown.status_code == 404, r_unknown.text


def test_new_endpoints_no_tenant_400(fresh_app: TestClient) -> None:
    """P2-W4: the 3 new endpoints reject requests with no tenant context."""
    token = _token(tenant_id="")
    for method, path, payload in (
        ("POST", "generate/process", {}),
        ("GET", "scheduling/templates", None),
        ("POST", "actions/execute", {"action_id": "act-send-email"}),
    ):
        if method == "GET":
            r = fresh_app.get(
                f"/api/v1/copilot/{path}",
                headers={"Authorization": f"Bearer {token}"},
            )
        else:
            r = fresh_app.post(
                f"/api/v1/copilot/{path}",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
        assert r.status_code == 400, (path, r.text)
        assert r.json()["code"] == "E_TENANT_REQUIRED"
