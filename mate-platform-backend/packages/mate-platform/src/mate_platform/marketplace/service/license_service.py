"""license_service — 激活 license + KMS 加密入库。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from uuid import UUID

from mate_platform import kms as _kms
from mate_platform.marketplace.domain.subscription import Subscription


# 模块级别默认 KMS;测试中可被 monkeypatch 覆盖
kms_encrypt = _kms.encrypt
kms_decrypt = _kms.decrypt


def _encrypt(plain: str) -> str:
    return kms_encrypt(plain)


def _decrypt(enc: str) -> str:
    return kms_decrypt(enc)


async def activate_license(
    *,
    session,
    mp_client,
    license_key: str,
    tenant_id: UUID,
    user_id: UUID,
) -> dict:
    """调用 SaaS 激活 license;持久化为 marketplace_subscription。"""
    resp = await mp_client.activate_license(license_key=license_key)

    sub = Subscription(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        sku=resp["sku"],
        license_key=kms_encrypt(license_key),
        status="active",
        license_payload=resp,
        purchased_at=datetime.now(timezone.utc),
        expires_at=(
            datetime.fromisoformat(
                resp["expires_at"].replace("Z", "+00:00")
            )
            if resp.get("expires_at")
            else None
        ),
        created_at=datetime.now(timezone.utc),
    )
    session.add(sub)
    await session.flush()
    return {"sku": resp["sku"], "expires_at": resp.get("expires_at")}