"""license_service 测试 — KMS 加密 + subscription 落库。

KMS 在 mate_platform.kms 提供对称 AES-GCM 接口;测试中用 monkeypatch 替换。
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from mate_platform.marketplace.service.license_service import (
    activate_license,
)


@pytest.mark.asyncio
async def test_activate_license_persists_kms_encrypted(monkeypatch):
    """license_key 入库前必须经 KMS 加密(硬规则 #12:Secret 不进 git)。

    测试用对称 mock:plain -> ENC[plain];ENC[plain] -> plain。
    """
    from mate_platform.marketplace import service
    from mate_platform.marketplace.service import license_service

    monkeypatch.setattr(
        license_service, "kms_encrypt", lambda plain: f"ENC[{plain}]"
    )
    monkeypatch.setattr(
        license_service,
        "kms_decrypt",
        lambda enc: enc[4:-1],
    )

    stored: list = []

    class _FakeSubscription:
        def __init__(self, **kwargs):
            stored.append(kwargs)

    monkeypatch.setattr(
        license_service, "Subscription", _FakeSubscription
    )

    class _FakeSession:
        async def add(self, obj):
            pass

        async def flush(self):
            pass

    mp_client = AsyncMock()
    mp_client.activate_license = AsyncMock(
        return_value={
            "sku": "SKU-001",
            "expires_at": "2099-01-01T00:00:00Z",
        }
    )

    result = await activate_license(
        session=_FakeSession(),
        mp_client=mp_client,
        license_key="raw-key",
        tenant_id="11111111-1111-1111-1111-111111111111",
        user_id="22222222-2222-2222-2222-222222222222",
    )

    assert result["sku"] == "SKU-001"
    assert stored[0]["license_key"] == "ENC[raw-key]"


def test_kms_encrypt_decrypt_roundtrip(monkeypatch):
    """对称加密往返;测试本地 mock。"""
    from mate_platform.marketplace.service import license_service

    monkeypatch.setattr(
        license_service, "kms_encrypt", lambda plain: f"ENC[{plain}]"
    )
    monkeypatch.setattr(
        license_service,
        "kms_decrypt",
        lambda enc: enc[4:-1],
    )

    plain = "raw-key-2"
    enc = license_service._encrypt(plain)
    assert enc.startswith("ENC[")
    assert license_service._decrypt(enc) == plain