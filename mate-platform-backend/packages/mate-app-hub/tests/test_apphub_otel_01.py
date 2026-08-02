"""APPHUB-RUNTIME-01 OTel integration tests (K3-2).

Verifies that the 4 critical paths emit the spans declared in
``telemetry.get_tracer``:

- ``apphub.runtime.load``  — loader.load_app_runtime
- ``apphub.runtime.execute`` — executor.execute_action
- ``apphub.shortlink.resolve`` — resolver.resolve
- ``apphub.shortlink.create``  — service.create_shortlink

The fixture uses ``telemetry.install_in_memory_exporter`` to swap
the global tracer provider for one backed by an
``InMemorySpanExporter``. The HTTP-level tests go through the
TestClient with a valid Keycloak token so the K3-3 ``_tenant_id``
guard does not reject the calls.
"""
from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from mate_app_hub.main import create_app
from mate_app_hub.repositories import in_memory as in_memory_repo
from mate_app_hub.telemetry import install_in_memory_exporter
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)


@pytest.fixture
def span_exporter() -> Iterator[InMemorySpanExporter]:
    yield from install_in_memory_exporter()


@pytest.fixture
def client(span_exporter: InMemorySpanExporter) -> Iterator[TestClient]:
    """Per-test TestClient with fresh in-memory store."""
    in_memory_repo.reset_store()
    app = create_app()
    yield TestClient(app)
    in_memory_repo.reset_store()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Build a valid Keycloak-format JWT for tenant-acme.

    Mirrors ``conftest._keycloak_token`` so this test file does not
    reach into ``tests.conftest`` directly (which is brittle when the
    test directory is the root of a pytest run).
    """
    import time as _time

    import jwt as _pyjwt

    now = int(_time.time())
    secret = "test-secret"
    token = _pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": ["tenant-acme"]},
            "tenant_id": "tenant-acme",
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        secret,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def test_load_app_runtime_emits_span(client: TestClient, span_exporter: InMemorySpanExporter, auth_headers: dict[str, str])-> None:
    """GET /apps/{app_id}/runtime → apphub.runtime.load span."""
    response = client.get("/api/v1/apphub/apps/kb/runtime", headers=auth_headers)
    assert response.status_code == 200, response.text
    spans = span_exporter.get_finished_spans()
    assert any(s.name == "apphub.runtime.load" for s in spans), (
        f"expected apphub.runtime.load span, got {[s.name for s in spans]}"
    )


def test_execute_action_emits_span(client: TestClient, span_exporter: InMemorySpanExporter, auth_headers: dict[str, str])-> None:
    """POST /apps/{app_id}/runtime/execute → apphub.runtime.submit_form span.

    K3-4 (RealExecutor) emits a per-action span named after the action
    type. ``submit_form`` → ``apphub.runtime.submit_form``.
    """
    response = client.post(
        "/api/v1/apphub/apps/kb/runtime/execute",
        headers=auth_headers,
        json={
            "action_id": "act-1",
            "action_type": "submit_form",
            "target": "form-login",
            "payload": {},
        },
    )
    assert response.status_code == 200, response.text
    spans = span_exporter.get_finished_spans()
    assert any(s.name == "apphub.runtime.submit_form" for s in spans), (
        f"expected apphub.runtime.submit_form span, got {[s.name for s in spans]}"
    )


def test_resolve_shortlink_emits_span(span_exporter: InMemorySpanExporter)-> None:
    """resolver.resolve → apphub.shortlink.resolve span."""
    # Use the real in-memory store for a clean test surface.
    from mate_app_hub.shortlink.repository import InMemoryShortlinkStore, ShortlinkEntry
    from mate_app_hub.shortlink.resolver import resolve
    real_store = InMemoryShortlinkStore()
    real_store.put(ShortlinkEntry(
        id="sl-ABC", tenant_id="tenant-a", app_id="app-1", code="ABC123",
    ))
    result = resolve(real_store, "tenant-a", "ABC123")
    assert result["app_id"] == "app-1"
    spans = span_exporter.get_finished_spans()
    assert any(s.name == "apphub.shortlink.resolve" for s in spans), (
        f"expected apphub.shortlink.resolve span, got {[s.name for s in spans]}"
    )


def test_create_shortlink_emits_span(span_exporter: InMemorySpanExporter)-> None:
    """service.create_shortlink → apphub.shortlink.create span."""
    from mate_app_hub.shortlink.repository import InMemoryShortlinkStore
    from mate_app_hub.shortlink.service import create_shortlink

    real_store = InMemoryShortlinkStore()
    entry = create_shortlink(real_store, "tenant-a", "app-1")
    assert entry.code
    spans = span_exporter.get_finished_spans()
    assert any(s.name == "apphub.shortlink.create" for s in spans), (
        f"expected apphub.shortlink.create span, got {[s.name for s in spans]}"
    )
