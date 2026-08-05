"""production profile 启动自检:SaaS 必须可达。

硬规则 #5:production profile 禁止 fallback;启动时若 SaaS 不可达,
直接 raise RuntimeError,拒绝启动(不允许走降级路径)。
"""
from __future__ import annotations

import os

import httpx


def _probe_saas(url: str) -> bool:
    """探测 SaaS 可达性。失败 / 5xx → 返回 False。"""
    try:
        r = httpx.get(
            f"{url.rstrip('/')}/v1/feed/trending",
            timeout=5,
        )
        return r.status_code < 500
    except Exception:  # noqa: BLE001
        return False


def assert_saas_reachable_or_exit(saas_url: str) -> None:
    """production profile 启动时调用;SaaS 不可达 → RuntimeError。

    dev / test profile 不会调用本函数,由 main.py 按 profile 决定。
    """
    if os.environ.get("MATE_PROFILE") == "production" and not _probe_saas(
        saas_url
    ):
        raise RuntimeError(
            f"SaaS unreachable at {saas_url}; "
            "MARKETPLACE-CONSUMER requires SaaS connectivity "
            "in production profile (硬规则 #5)"
        )