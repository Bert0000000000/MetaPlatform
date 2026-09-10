"""G20：副作用投递 —— outbox 事件 → webhook（HMAC 签名 + 重试 + 投递审计）。

Palantir 语义（调研材料 01 §Action）：side effects 含 notifications/webhooks；
投递可观测（attempts/status/last_error）、可重试（退避 ×3）。

- 订阅：``ont_webhook_subscription``（event_type 通配 ``*`` 或精确匹配）；
- 投递：``deliver_pending`` 扫 outbox 未成功投递事件 → POST（json）+
  ``X-Mate-Signature: sha256=<hex>``（HMAC-SHA256(secret, body)）+
  ``X-Mate-Event`` / ``X-Mate-Event-Id`` 头；2xx 即成功；
- 重试：单次调用内退避重试（0.2/0.5/1.0s，共 3 次尝试）；
- 审计：``ont_webhook_delivery`` 每次投递尝试终态一行。

调度：dev 手动 POST /webhooks/deliver；生产挂 Scheduler 周期触发（留接口）。
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any

__all__ = ["RETRY_DELAYS", "deliver_pending", "sign_payload"]

RETRY_DELAYS = (0.2, 0.5, 1.0)


def sign_payload(secret: str, body: bytes) -> str:
    """HMAC-SHA256 签名（hex）。验证方：``hmac.compare_digest(sha256_hexdigest, sig)``。"""
    return "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _matching_subscriptions(repo: Any, tenant_id: str, event_type: str) -> list[dict[str, Any]]:
    subs = repo.list_webhook_subscriptions()
    return [
        s
        for s in subs
        # 空租户（InMemory 镜像）视为通配 —— dev 同语义
        if (not s.get("tenant_id") or not tenant_id or s.get("tenant_id") == tenant_id)
        and (s.get("event_type") == "*" or s.get("event_type") == event_type)
        and s.get("active", True)
    ]


def _already_delivered(repo: Any, event_id: str, sub_rid: str) -> bool:
    return repo.webhook_delivery_exists(event_id, sub_rid)


def deliver_pending(repo: Any, *, limit: int = 50) -> dict[str, Any]:
    """扫描 outbox 未投递事件 → 逐订阅投递（重试退避）→ 记审计行。

    返回 {delivered, failed, skipped}。
    """
    import httpx

    events = repo.list_outbox_events(since_id=0, limit=limit)
    delivered = failed = skipped = 0
    for ev in events:
        for sub in _matching_subscriptions(repo, ev.get("tenant_id", ""), ev.get("event_type", "")):
            sub_rid = sub["rid"]
            if _already_delivered(repo, ev["event_id"], sub_rid):
                skipped += 1
                continue
            body = json.dumps(
                {
                    "event_id": ev["event_id"],
                    "event_type": ev["event_type"],
                    "payload": ev.get("payload") or {},
                    "created_at": str(ev.get("created_at", "")),
                },
                ensure_ascii=False,
                default=str,
            ).encode("utf-8")
            headers = {
                "Content-Type": "application/json",
                "X-Mate-Event": ev["event_type"],
                "X-Mate-Event-Id": ev["event_id"],
                "X-Mate-Signature": sign_payload(sub.get("secret", ""), body),
            }
            ok, attempts, last_err = False, 0, ""
            for attempt, delay in enumerate((0.0, *RETRY_DELAYS), start=1):
                if delay:
                    time.sleep(delay)
                attempts = attempt
                try:
                    resp = httpx.post(sub["url"], content=body, headers=headers, timeout=5.0)
                    if 200 <= resp.status_code < 300:
                        ok = True
                        break
                    last_err = f"HTTP {resp.status_code}"
                except Exception as e:
                    last_err = str(e)[:300]
                if attempt > len(RETRY_DELAYS):
                    break
            repo.record_webhook_delivery(
                event_id=ev["event_id"],
                subscription_rid=sub_rid,
                status="delivered" if ok else "failed",
                attempts=attempts,
                last_error=last_err,
                tenant_id=ev.get("tenant_id", ""),
            )
            if ok:
                delivered += 1
            else:
                failed += 1
    return {"delivered": delivered, "failed": failed, "skipped": skipped}
