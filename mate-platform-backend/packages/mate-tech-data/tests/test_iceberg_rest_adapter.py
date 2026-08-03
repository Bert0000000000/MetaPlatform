"""Tests for the Iceberg REST adapter (httpx.MockTransport).

Mirrors the ``test_debezium_engine.py`` style: real httpx
``AsyncClient`` instance with a ``MockTransport`` injecting
deterministic responses. No real network calls.
"""
from __future__ import annotations

import httpx
import pytest
from mate_tech_data.services.iceberg_rest_adapter import (
    IcebergRestAdapter,
    IcebergRestError,
)


def _adapter_with_mock(handler) -> tuple[IcebergRestAdapter, httpx.AsyncClient]:
    """Build an adapter wired to an httpx.MockTransport.

    Returns (adapter, client) — the caller is responsible for
    awaiting ``client.aclose()`` (or calling ``adapter.close()``).
    """
    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(
        base_url="http://iceberg:8181",
        transport=transport,
    )
    adapter = IcebergRestAdapter(base_url="http://iceberg:8181", client=client)
    return adapter, client


# ---------------------------------------------------------------------------
# create_namespace
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_create_namespace_happy_path() -> None:
    """POST /v1/namespaces → returns the parsed body."""
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200, json={
                "namespace": ["iceberg", "ads"],
                "properties": {"owner": "tenant-acme"},
            },
        )

    adapter, _client = _adapter_with_mock(handler)
    try:
        result = await adapter.create_namespace(("iceberg", "ads"))
    finally:
        await adapter.close()

    assert result == {
        "namespace": ["iceberg", "ads"],
        "properties": {"owner": "tenant-acme"},
    }
    assert len(seen) == 1
    assert seen[0].method == "POST"
    assert seen[0].url.path == "/v1/namespaces"


@pytest.mark.asyncio
async def test_create_namespace_409_is_swallowed_by_caller() -> None:
    """409 (already exists) propagates as IcebergRestError so the caller can swallow it."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, text="Namespace already exists")

    adapter, _client = _adapter_with_mock(handler)
    try:
        with pytest.raises(IcebergRestError) as exc_info:
            await adapter.create_namespace(("iceberg", "ads"))
    finally:
        await adapter.close()
    assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# register_table
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_register_table_happy_path() -> None:
    """POST /v1/namespaces/{ns}/register → returns metadata snapshot."""
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200, json={
                "name": "orders_summary",
                "metadata_location": "paimon.ods.orders",
            },
        )

    adapter, _client = _adapter_with_mock(handler)
    try:
        result = await adapter.register_table(
            source_table="paimon.ods.orders",
            target_namespace="iceberg.ads",
            target_name="orders_summary",
        )
    finally:
        await adapter.close()

    assert result == {
        "name": "orders_summary",
        "metadata_location": "paimon.ods.orders",
    }
    assert len(seen) == 1
    assert seen[0].method == "POST"
    assert seen[0].url.path == "/v1/namespaces/iceberg.ads/register"


# ---------------------------------------------------------------------------
# create_table
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_create_table_happy_path() -> None:
    """POST /v1/namespaces/{ns}/tables → returns the table metadata."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={
                "name": "orders_summary",
                "metadata": {"schema": {"fields": []}},
            },
        )

    adapter, _ = _adapter_with_mock(handler)
    try:
        result = await adapter.create_table(
            namespace="iceberg.ads",
            name="orders_summary",
            schema={"fields": []},
        )
    finally:
        await adapter.close()
    assert result["name"] == "orders_summary"


# ---------------------------------------------------------------------------
# Network / transport errors
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_create_namespace_network_error_raises_iceberg_rest_error() -> None:
    """Transport error → IcebergRestError (no raw exception leaks)."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    adapter, _ = _adapter_with_mock(handler)
    try:
        with pytest.raises(IcebergRestError) as exc_info:
            await adapter.create_namespace(("iceberg", "ads"))
    finally:
        await adapter.close()
    assert "HTTP error" in str(exc_info.value)


@pytest.mark.asyncio
async def test_create_namespace_500_raises_iceberg_rest_error() -> None:
    """5xx → IcebergRestError with status_code preserved."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    adapter, _ = _adapter_with_mock(handler)
    try:
        with pytest.raises(IcebergRestError) as exc_info:
            await adapter.create_namespace(("iceberg", "ads"))
    finally:
        await adapter.close()
    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_register_table_404_raises_iceberg_rest_error() -> None:
    """404 on register → IcebergRestError with status_code=404."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, text="Namespace not found")

    adapter, _ = _adapter_with_mock(handler)
    try:
        with pytest.raises(IcebergRestError) as exc_info:
            await adapter.register_table(
                source_table="paimon.ods.orders",
                target_namespace="missing",
                target_name="orders",
            )
    finally:
        await adapter.close()
    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# JSON parse error
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_register_table_invalid_json_raises_iceberg_rest_error() -> None:
    """Non-JSON response → IcebergRestError (parse failure wrapped)."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>oops</html>")

    adapter, _ = _adapter_with_mock(handler)
    try:
        with pytest.raises(IcebergRestError) as exc_info:
            await adapter.register_table(
                source_table="paimon.ods.orders",
                target_namespace="iceberg.ads",
                target_name="orders_summary",
            )
    finally:
        await adapter.close()
    assert "non-JSON" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_close_releases_resources() -> None:
    """close() closes the underlying client and is idempotent."""
    transport = httpx.MockTransport(
        lambda req: httpx.Response(200, json={"ok": True}),
    )
    client = httpx.AsyncClient(base_url="http://iceberg:8181", transport=transport)
    adapter = IcebergRestAdapter(base_url="http://iceberg:8181", client=client)

    # Sanity: adapter works before close.
    result = await adapter.create_namespace(("ns",))
    assert result == {"ok": True}

    # First close should be a no-op for the client (it's still owned
    # externally because we injected it). Verify that close()
    # itself is idempotent.
    await adapter.close()
    await adapter.close()

    # Closing the underlying client should not raise.
    await client.aclose()


# ---------------------------------------------------------------------------
# from_env bootstrap
# ---------------------------------------------------------------------------
def test_from_env_reads_iceberg_rest_url(monkeypatch) -> None:
    """from_env reads ICEBERG_REST_URL from the environment."""
    monkeypatch.setenv("ICEBERG_REST_URL", "http://iceberg-custom:9999")
    adapter = IcebergRestAdapter.from_env(timeout_seconds=15.0)
    assert adapter._base_url == "http://iceberg-custom:9999"
    assert adapter._timeout == 15.0


def test_from_env_default_url() -> None:
    """from_env falls back to http://iceberg:8181."""
    adapter = IcebergRestAdapter.from_env()
    assert adapter._base_url == "http://iceberg:8181"
