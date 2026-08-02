"""APPHUB-RUNTIME-01 phase B tests — runtime engine 7 modules + 3 endpoints.

Covers:
  - schema:  RuntimeContext / RenderNode / RuntimeAction / ActionResult
  - loader:  load_app_runtime (existing / nonexistent / cross-tenant / modules / pages / version)
  - renderer: render_page (nodes / filtered / empty / layout / children)
  - executor: execute_action (submit_form / trigger_flow / call_api / navigate / unknown / empty payload)
  - binding:  resolve_field_binding (basic / no-flow / complex)
  - authz:    check_runtime_access / check_publish_access / check_shortlink_access
  - endpoints: GET /runtime + POST /execute + POST /publish
  - errors:   RuntimeErrorCode enum
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from mate_app_hub.main import create_app
from mate_app_hub.repositories import in_memory as in_memory_repo
from mate_app_hub.runtime import (
    ActionResult,
    RenderNode,
    RuntimeAction,
    RuntimeContext,
    RuntimeErrorCode,
    check_publish_access,
    check_runtime_access,
    check_shortlink_access,
    execute_action,
    load_app_runtime,
    render_page,
    resolve_field_binding,
)
from mate_platform.messaging.outbox import InMemoryOutboxWriter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _reset_store() -> None:
    """Reset the in-memory store before and after each test."""
    in_memory_repo.reset_store()
    yield
    in_memory_repo.reset_store()


@pytest.fixture
def outbox() -> InMemoryOutboxWriter:
    return InMemoryOutboxWriter()


@pytest.fixture
def client(outbox: InMemoryOutboxWriter) -> TestClient:
    """Per-test TestClient with fresh store + outbox wired."""
    in_memory_repo.reset_store()
    app = create_app()
    app.state.outbox_writer = outbox
    yield TestClient(app)
    in_memory_repo.reset_store()


# ---------------------------------------------------------------------------
# Schema tests (3)
# ---------------------------------------------------------------------------
def test_runtime_context_creation() -> None:
    ctx = RuntimeContext(
        app_id="kb", tenant_id="tenant-acme",
        version="1.0.0", user_role="admin",
        modules=[{"code": "kb-search"}],
    )
    assert ctx.app_id == "kb"
    assert ctx.tenant_id == "tenant-acme"
    assert ctx.version == "1.0.0"
    assert ctx.user_role == "admin"
    assert len(ctx.modules) == 1


def test_render_node_tree() -> None:
    child = RenderNode(node_type="form", title="Child Form")
    parent = RenderNode(
        node_type="page", title="Parent Page",
        children=[child],
    )
    assert parent.node_type == "page"
    assert len(parent.children) == 1
    assert parent.children[0].title == "Child Form"
    assert parent.children[0].node_type == "form"


def test_runtime_action_creation() -> None:
    action = RuntimeAction(
        action_id="act-1",
        action_type="submit_form",
        target="form-login",
        payload_schema={"fields": ["username", "password"]},
    )
    assert action.action_id == "act-1"
    assert action.action_type == "submit_form"
    assert action.target == "form-login"
    assert "username" in action.payload_schema["fields"]


# ---------------------------------------------------------------------------
# Loader tests (6)
# ---------------------------------------------------------------------------
def test_load_app_runtime_existing_app() -> None:
    ctx = load_app_runtime("tenant-acme", "kb")
    assert ctx.app_id == "kb"
    assert ctx.tenant_id == "tenant-acme"


def test_load_app_runtime_nonexistent_returns_error() -> None:
    with pytest.raises(ValueError, match="not found"):
        load_app_runtime("tenant-acme", "nonexistent-app")


def test_load_app_runtime_cross_tenant_returns_error() -> None:
    from mate_app_hub.repositories import ApphubApp, put_app

    # Register a custom app only in tenant-acme.
    put_app(
        "tenant-acme",
        ApphubApp(
            id="app-rt-only",
            tenant_id="tenant-acme",
            name="RT Only",
            code="rt-only",
            category="knowledge",
            description="test",
            version="1.0.0",
        ),
    )
    # tenant-globex does not have this app → ValueError.
    with pytest.raises(ValueError, match="not found"):
        load_app_runtime("tenant-globex", "rt-only")


def test_load_app_runtime_includes_modules() -> None:
    ctx = load_app_runtime("tenant-acme", "kb")
    assert len(ctx.modules) >= 1
    module_codes = {m["code"] for m in ctx.modules}
    assert "kb-search" in module_codes
    assert "kb-doc" in module_codes


def test_load_app_runtime_includes_pages() -> None:
    ctx = load_app_runtime("tenant-acme", "kb")
    for mod in ctx.modules:
        assert "pages" in mod
        assert isinstance(mod["pages"], list)


def test_load_app_runtime_version_latest() -> None:
    ctx = load_app_runtime("tenant-acme", "kb")
    # Default version="latest" resolves to the app's actual version.
    assert ctx.version is not None
    assert ctx.version != ""


# ---------------------------------------------------------------------------
# Renderer tests (5)
# ---------------------------------------------------------------------------
def test_render_page_returns_nodes() -> None:
    ctx = RuntimeContext(
        app_id="test-app", tenant_id="t1",
        modules=[{
            "code": "mod-1",
            "name": "Module 1",
            "pages": [
                {"code": "p-1", "name": "Page 1", "layout": "single"},
                {"code": "p-2", "name": "Page 2", "layout": "split"},
            ],
        }],
    )
    nodes = render_page(ctx)
    assert len(nodes) == 2
    assert all(n.node_type == "page" for n in nodes)


def test_render_page_filtered_by_module() -> None:
    ctx = RuntimeContext(
        app_id="test-app", tenant_id="t1",
        modules=[
            {
                "code": "mod-a",
                "name": "Module A",
                "pages": [{"code": "pa", "name": "PA", "layout": "single"}],
            },
            {
                "code": "mod-b",
                "name": "Module B",
                "pages": [{"code": "pb", "name": "PB", "layout": "single"}],
            },
        ],
    )
    nodes = render_page(ctx, module_code="mod-a")
    assert len(nodes) == 1
    assert nodes[0].config["module_code"] == "mod-a"


def test_render_page_empty_app_returns_empty() -> None:
    ctx = RuntimeContext(app_id="empty", tenant_id="t1", modules=[])
    nodes = render_page(ctx)
    assert nodes == []


def test_render_node_has_layout() -> None:
    ctx = RuntimeContext(
        app_id="test-app", tenant_id="t1",
        modules=[{
            "code": "mod-1",
            "name": "M1",
            "pages": [{"code": "p-1", "name": "P1", "layout": "two_col"}],
        }],
    )
    nodes = render_page(ctx)
    assert len(nodes) == 1
    assert nodes[0].layout["type"] == "two_col"


def test_render_node_has_children() -> None:
    child = RenderNode(node_type="form", title="Sub-form")
    parent = RenderNode(node_type="page", title="Page", children=[child])
    assert len(parent.children) == 1
    assert parent.children[0].title == "Sub-form"
    # Default children is an empty list.
    bare = RenderNode(node_type="page", title="Bare")
    assert bare.children == []


# ---------------------------------------------------------------------------
# Executor tests (6)
# ---------------------------------------------------------------------------
def _ctx() -> RuntimeContext:
    return RuntimeContext(app_id="kb", tenant_id="tenant-acme")


def test_execute_submit_form_success() -> None:
    action = RuntimeAction(action_id="a1", action_type="submit_form", target="f1")
    result = asyncio.run(execute_action(_ctx(), action, {"name": "test"}))
    assert result.success is True
    assert result.data["submitted"] is True


def test_execute_trigger_flow_success() -> None:
    action = RuntimeAction(action_id="a2", action_type="trigger_flow", target="flow-1")
    result = asyncio.run(execute_action(_ctx(), action, {}))
    assert result.success is True
    assert result.data["flow_id"] == "flow-1"


def test_execute_call_api_success() -> None:
    action = RuntimeAction(action_id="a3", action_type="call_api", target="/api/v1/test")
    result = asyncio.run(execute_action(_ctx(), action, {}))
    assert result.success is True
    assert result.data["endpoint"] == "/api/v1/test"


def test_execute_navigate_returns_url() -> None:
    action = RuntimeAction(action_id="a4", action_type="navigate", target="/kb/detail")
    result = asyncio.run(execute_action(_ctx(), action, {}))
    assert result.success is True
    assert result.data["url"] == "/kb/detail"


def test_execute_unknown_action_returns_error() -> None:
    action = RuntimeAction(action_id="a5", action_type="delete_record", target="x")
    result = asyncio.run(execute_action(_ctx(), action, {}))
    assert result.success is False
    assert result.error is not None
    assert "unknown" in result.error.lower()


def test_execute_action_with_empty_payload() -> None:
    action = RuntimeAction(action_id="a6", action_type="submit_form", target="f2")
    result = asyncio.run(execute_action(_ctx(), action, {}))
    assert result.success is True
    assert result.data["payload"] == {}


# ---------------------------------------------------------------------------
# Binding tests (3)
# ---------------------------------------------------------------------------
def test_resolve_field_binding_basic() -> None:
    form_config = {"fields": [{"name": "title", "bind": "flow_title"}]}
    flow_config = {"variables": {"flow_title": {"type": "string"}}}
    mapping = resolve_field_binding(form_config, flow_config)
    assert mapping["title"] == "flow_title"


def test_resolve_field_binding_no_flow_config() -> None:
    form_config = {"fields": [{"name": "title"}, {"name": "body"}]}
    mapping = resolve_field_binding(form_config, {})
    # No flow variables → identity mapping.
    assert mapping["title"] == "title"
    assert mapping["body"] == "body"


def test_resolve_field_binding_complex_mapping() -> None:
    form_config = {
        "fields": [
            {"name": "applicant", "bind": "initiator"},
            {"name": "amount", "bind": "request_amount"},
            {"name": "department"},  # no explicit bind
        ]
    }
    flow_config = {
        "variables": {
            "initiator": {"type": "string"},
            "request_amount": {"type": "number"},
            "department": {"type": "string"},
        }
    }
    mapping = resolve_field_binding(form_config, flow_config)
    assert mapping["applicant"] == "initiator"
    assert mapping["amount"] == "request_amount"
    # "department" matches a flow variable directly.
    assert mapping["department"] == "department"


# ---------------------------------------------------------------------------
# Authz tests (4)
# ---------------------------------------------------------------------------
def test_admin_has_full_access() -> None:
    ctx = RuntimeContext(app_id="kb", tenant_id="t1", user_role="admin")
    assert check_runtime_access(ctx, "admin") is True
    assert check_publish_access("admin") is True


def test_editor_blocked_from_publish() -> None:
    ctx = RuntimeContext(app_id="kb", tenant_id="t1", user_role="editor")
    assert check_runtime_access(ctx, "editor") is True
    assert check_publish_access("editor") is False


def test_viewer_read_only() -> None:
    ctx = RuntimeContext(app_id="kb", tenant_id="t1", user_role="viewer")
    assert check_runtime_access(ctx, "viewer") is True
    assert check_publish_access("viewer") is False


def test_check_shortlink_access_role_match() -> None:
    ctx = RuntimeContext(app_id="kb", tenant_id="t1")
    assert check_shortlink_access(ctx, "viewer") is True
    assert check_shortlink_access(ctx, None) is False


# ---------------------------------------------------------------------------
# Endpoint tests (5)
# ---------------------------------------------------------------------------
def test_get_runtime_endpoint_returns_200(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    r = client.get("/api/v1/apphub/apps/kb/runtime", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["app_id"] == "kb"
    assert "modules" in body
    assert "render_tree" in body
    assert len(body["modules"]) >= 1


def test_get_runtime_endpoint_cross_tenant_404(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    auth_headers_globex: dict[str, str],
) -> None:
    # Register a custom app in tenant-acme only.
    r_reg = client.post(
        "/api/v1/apphub/apps",
        json={
            "name": "RT Custom", "code": "rt-custom",
            "category": "knowledge", "version": "1.0.0",
        },
        headers=auth_headers_acme,
    )
    assert r_reg.status_code == 201, r_reg.text

    # tenant-globex cannot see tenant-acme's custom app → 404.
    r = client.get(
        "/api/v1/apphub/apps/rt-custom/runtime",
        headers=auth_headers_globex,
    )
    assert r.status_code == 404, r.text


def test_execute_endpoint_submit_form(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    r = client.post(
        "/api/v1/apphub/apps/kb/runtime/execute",
        json={
            "action_id": "act-1",
            "action_type": "submit_form",
            "target": "form-kb",
            "payload": {"query": "hello"},
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["action_id"] == "act-1"


def test_publish_endpoint_returns_published(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    r = client.post(
        "/api/v1/apphub/apps/kb/publish",
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "PUBLISHED"
    assert body["version"] == "1.0.0"
    assert body["app_id"] == "kb"


def test_publish_endpoint_emits_outbox(
    client: TestClient,
    auth_headers_acme: dict[str, str],
    outbox: InMemoryOutboxWriter,
) -> None:
    client.post(
        "/api/v1/apphub/apps/kb/publish",
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    published = [e for e in events if e.type == "apphub.app.published"]
    assert len(published) >= 1
    assert published[0].payload["status"] == "PUBLISHED"


# ---------------------------------------------------------------------------
# Errors tests (3)
# ---------------------------------------------------------------------------
def test_error_code_enum_values() -> None:
    assert RuntimeErrorCode.APP_NOT_FOUND.value == "APP_NOT_FOUND"
    assert RuntimeErrorCode.MODULE_NOT_FOUND.value == "MODULE_NOT_FOUND"
    assert RuntimeErrorCode.ACTION_NOT_SUPPORTED.value == "ACTION_NOT_SUPPORTED"
    assert RuntimeErrorCode.ACCESS_DENIED.value == "ACCESS_DENIED"
    assert RuntimeErrorCode.VERSION_CONFLICT.value == "VERSION_CONFLICT"


def test_app_not_found_error() -> None:
    with pytest.raises(ValueError, match="not found"):
        load_app_runtime("tenant-acme", "no-such-app")
    # The error code is available for structured error handling.
    assert RuntimeErrorCode.APP_NOT_FOUND.value == "APP_NOT_FOUND"


def test_access_denied_error() -> None:
    ctx = RuntimeContext(app_id="kb", tenant_id="t1")
    # Unknown role → access denied.
    assert check_runtime_access(ctx, "guest") is False
    assert RuntimeErrorCode.ACCESS_DENIED.value == "ACCESS_DENIED"


# ---------------------------------------------------------------------------
# K3-3 negative tenant tests (no Authorization header → 401/403)
# ---------------------------------------------------------------------------
def test_get_runtime_without_ctx_returns_401(client: TestClient) -> None:
    """无 ctx 调 GET /apps/{app_id}/runtime → 401/403."""
    response = client.get("/api/v1/apphub/apps/app-1/runtime")
    assert response.status_code in (401, 403), (
        f"expected 401/403, got {response.status_code}: {response.text}"
    )


def test_post_runtime_execute_without_ctx_returns_401(client: TestClient) -> None:
    """无 ctx 调 POST /apps/{app_id}/runtime/execute → 401/403."""
    response = client.post(
        "/api/v1/apphub/apps/app-1/runtime/execute",
        json={"action_id": "act-1", "action_type": "submit_form",
              "target": "form-1", "payload": {}},
    )
    assert response.status_code in (401, 403), (
        f"expected 401/403, got {response.status_code}: {response.text}"
    )


def test_post_publish_without_ctx_returns_401(client: TestClient) -> None:
    """无 ctx 调 POST /apps/{app_id}/publish → 401/403."""
    response = client.post("/api/v1/apphub/apps/app-1/publish")
    assert response.status_code in (401, 403), (
        f"expected 401/403, got {response.status_code}: {response.text}"
    )


def test_get_shortlink_without_ctx_returns_401(client: TestClient) -> None:
    """无 ctx 调 GET /shortlinks/{code} → 401/403."""
    response = client.get("/api/v1/apphub/shortlinks/ABC123")
    assert response.status_code in (401, 403), (
        f"expected 401/403, got {response.status_code}: {response.text}"
    )


def test_post_shortlink_without_ctx_returns_401(client: TestClient) -> None:
    """无 ctx 调 POST /shortlinks → 401/403."""
    response = client.post(
        "/api/v1/apphub/shortlinks",
        json={"app_id": "app-1", "role": "viewer"},
    )
    assert response.status_code in (401, 403), (
        f"expected 401/403, got {response.status_code}: {response.text}"
    )
