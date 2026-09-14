"""Tests for /api/v1/admin/configs endpoints (FR-DASH-006-05)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_list_configs(client):
    r = await client.get("/api/v1/admin/configs?pageSize=50")
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert len(items) >= 10


@pytest.mark.asyncio
async def test_categories(client):
    r = await client.get("/api/v1/admin/configs/categories")
    assert r.status_code == 200
    cats = r.json()["data"]
    assert any(c["value"] == "SSO" for c in cats)
    assert any(c["value"] == "RATE_LIMIT" for c in cats)


@pytest.mark.asyncio
async def test_update_string(client):
    r = await client.put(
        "/api/v1/admin/configs/security.password_min_length",
        json={"value": 10, "note": "test update"},
    )
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert body["value"] == 10  # int type auto-decoded


@pytest.mark.asyncio
async def test_update_enum_validates(client):
    """enum options restricted by value_type=enum."""
    r = await client.put(
        "/api/v1/admin/configs/message.sms.provider",
        json={"value": "alibaba"},  # not in enum_options
    )
    assert r.status_code == 400
    assert "E400_VALIDATION" in r.text


@pytest.mark.asyncio
async def test_update_creates_audit_log(client):
    # Use unique key to isolate
    r = await client.put(
        "/api/v1/admin/configs/security.password_min_length",
        json={"value": 12, "note": "audit trigger"},
    )
    assert r.status_code == 200
    r = await client.get("/api/v1/admin/logs/audit?module=config&pageSize=5")
    items = r.json()["data"]["items"]
    assert any("security.password_min_length" in (log.get("resourceId") or "") for log in items)


@pytest.mark.asyncio
async def test_sensitive_masked(client):
    r = await client.get("/api/v1/admin/configs?pageSize=50")
    items = r.json()["data"]["items"]
    sensitive = [c for c in items if c["is_sensitive"]]
    assert sensitive, "expected seeded sensitive config"
    assert all(c["raw_value"] == "***" for c in sensitive)
    # value 也必须掩码（read 端不回真实 key）
    assert all(c["value"] == "***" for c in sensitive)


@pytest.mark.asyncio
async def test_sensitive_write_only_update_keeps_value(client):
    """write-only 语义：更新请求带掩码/空串 → 保持原值，不落库覆盖。"""
    # 先写入一个真实 key
    r = await client.put(
        "/api/v1/admin/configs/ai.provider.custom.api_key",
        json={"value": "sk-real-secret-value", "note": "托管初始写入"},
    )
    assert r.status_code == 200, r.text
    # 读回：掩码
    r = await client.get("/api/v1/admin/configs?keyword=ai.provider.custom.api_key")
    item = next(c for c in r.json()["data"]["items"] if c["key"] == "ai.provider.custom.api_key")
    assert item["value"] == "***"

    # 用掩码更新 → 原值保持
    r = await client.put(
        "/api/v1/admin/configs/ai.provider.custom.api_key",
        json={"value": "***", "note": "管理员未改动 key 字段"},
    )
    assert r.status_code == 200, r.text
    # 空串同样保持
    r = await client.put(
        "/api/v1/admin/configs/ai.provider.custom.api_key",
        json={"value": ""},
    )
    assert r.status_code == 200, r.text

    # 真实值仍可被覆盖（换 key 生效）
    r = await client.put(
        "/api/v1/admin/configs/ai.provider.custom.api_key",
        json={"value": "sk-rotated-value"},
    )
    assert r.status_code == 200, r.text
    # 审计明细不落敏感明文
    r = await client.get("/api/v1/admin/logs/audit?module=config&pageSize=20")
    logs = r.json()["data"]["items"]
    details = " ".join(str(log.get("detail") or "") for log in logs)
    assert "sk-real-secret-value" not in details
    assert "sk-rotated-value" not in details


@pytest.mark.asyncio
async def test_reveal_requires_service_secret(client, monkeypatch):
    """reveal=1 仅携带正确 X-Service-Secret（服务共享密钥）的服务调用可用。

    用户 token 与服务 token 的 azp 相同（都是 SERVICE_CLIENT_ID），
    client_id 无法区分 —— 以共享密钥头为准；密钥未配置时 fail-closed。
    """
    # 1) 无密钥头（浏览器管理员会话）→ 403
    r = await client.get("/api/v1/admin/configs?reveal=1&pageSize=50")
    assert r.status_code == 403

    # 2) 密钥未配置 → fail-closed，即使带头也 403
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "")
    r = await client.get(
        "/api/v1/admin/configs?reveal=1&pageSize=50",
        headers={"X-Service-Secret": "anything"},
    )
    assert r.status_code == 403

    # 3) 正确密钥 → reveal 返回真实值
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "test-service-secret")
    await client.put(
        "/api/v1/admin/configs/ai.provider.custom.api_key",
        json={"value": "sk-reveal-check"},
    )
    r = await client.get(
        "/api/v1/admin/configs?reveal=1&keyword=ai.provider.custom.api_key",
        headers={"X-Service-Secret": "test-service-secret"},
    )
    assert r.status_code == 200, r.text
    item = next(c for c in r.json()["data"]["items"] if c["key"] == "ai.provider.custom.api_key")
    assert item["value"] == "sk-reveal-check"

    # 4) 错误密钥 → 403
    r = await client.get(
        "/api/v1/admin/configs?reveal=1&pageSize=50",
        headers={"X-Service-Secret": "wrong-secret"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_service_read_endpoint(client, monkeypatch):
    """机器间取数通道：X-Service-Secret 守门 + ai.provider.* 命名空间限制。"""
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "test-service-secret")
    await client.put(
        "/api/v1/admin/configs/ai.provider.custom.api_key",
        json={"value": "sk-service-read-check"},
    )

    # 无密钥 → 403
    r = await client.get("/api/v1/admin/configs/service-read")
    assert r.status_code == 403

    # 错误密钥 → 403
    r = await client.get(
        "/api/v1/admin/configs/service-read",
        headers={"X-Service-Secret": "wrong"},
    )
    assert r.status_code == 403

    # 正确密钥 → 返回 ai.provider.* 真实值（含 key 明文，供服务端解析）
    r = await client.get(
        "/api/v1/admin/configs/service-read",
        headers={"X-Service-Secret": "test-service-secret"},
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["ai.provider.custom.api_key"] == "sk-service-read-check"
    assert "ai.provider.custom.base_url" in data  # 命名空间内非敏感项也在
    # 命名空间外（如 branding.*）不可达 —— 前缀被强制为 ai.provider.
    r = await client.get(
        "/api/v1/admin/configs/service-read?prefix=branding.",
        headers={"X-Service-Secret": "test-service-secret"},
    )
    assert r.status_code == 200
    assert all(k.startswith("ai.provider.") for k in r.json()["data"].keys())

    # 密钥未配置 → fail-closed
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "")
    r = await client.get(
        "/api/v1/admin/configs/service-read",
        headers={"X-Service-Secret": "anything"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_ark_provider_seeded(client):
    """ARK 正式托管位：ai.provider.ark.* 四件套 + default_active 枚举含 ark。"""
    r = await client.get("/api/v1/admin/configs?keyword=ai.provider.ark&pageSize=20")
    items = r.json()["data"]["items"]
    keys = {c["key"] for c in items}
    assert "ai.provider.ark.base_url" in keys
    assert "ai.provider.ark.api_key" in keys
    assert "ai.provider.ark.default_model" in keys
    api_key = next(c for c in items if c["key"] == "ai.provider.ark.api_key")
    assert api_key["is_sensitive"] is True
    # base_url 是 ARK Plan 专属通道
    base = next(c for c in items if c["key"] == "ai.provider.ark.base_url")
    assert "api/plan/v3" in str(base["value"])

    r = await client.get("/api/v1/admin/configs?keyword=ai.provider.default_active")
    item = next(
        c for c in r.json()["data"]["items"] if c["key"] == "ai.provider.default_active"
    )
    assert "ark" in (item.get("enum_options") or [])
