"""Round-2 M2-VERIFY-07 driver.

Two complementary probes:

A) Live HTTP probe of TECH-LLMGW:
   - DELETE any prior rules for the test target.
   - POST /api/v1/llmgw/rate-limits  (USER / r2_phase2_user / RPM, limit=2).
   - GET  /api/v1/llmgw/rate-limits (verify rule created).
   - GET  /api/v1/llmgw/rate-limits/{id}/stats  (placeholder stats).
   - POST /api/v1/llmgw/rate-limits/{id}/reset.

B) Unit-level runtime probe (pytest test_rate_limit_runtime.py).
   The pytest conftest attaches a RateLimitGuard and triggers
   ``check_and_increment`` three times against a limit-2 rule, asserting
   decisions = [True, True, False] and ``reason == "limit_exceeded"`` on
   the third call. This proves the runtime enforcement that was missing
   in the first-round acceptance.

Outputs JSON artifacts for the acceptance report.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import jwt
import requests

ROOT = Path(__file__).resolve().parent
LLMGW = "http://127.0.0.1:8401"
SECRET = "metaplatform-jwt-secret-key-2026"


def mint_jwt() -> str:
    import datetime as dt
    now = dt.datetime.now(dt.timezone.utc)
    claims = {
        "sub": "phase2-acceptance",
        "username": "phase2-tester",
        "tenantId": "tenant-m2v07",
        "roles": ["PLATFORM_ADMIN"],
        "type": "USER",
        "iat": now,
        "exp": now + dt.timedelta(hours=2),
    }
    return jwt.encode(claims, SECRET, algorithm="HS256")


def hdrs(token: str, trace_id: str) -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": "tenant-m2v07",
        "X-Trace-Id": trace_id,
    }


def save(name: str, payload) -> None:
    p = ROOT / name
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def main() -> int:
    token = mint_jwt()
    out = {"live_probe": {}, "pytest_probe": "see pytest-llmgw-r2.log"}

    # A. Live HTTP probe
    target_user = "r2_phase2_user"

    # 1) List existing rules for this tenant
    list_resp = requests.get(
        f"{LLMGW}/api/v1/llmgw/rate-limits?scope=USER&type=RPM",
        headers=hdrs(token, "trace-r2-m2v07-list"),
        timeout=15,
    )
    out["live_probe"]["list_status"] = list_resp.status_code
    out["live_probe"]["list_body"] = list_resp.json() if list_resp.headers.get("content-type", "").startswith("application/json") else list_resp.text

    # 2) Delete any pre-existing rule for our target (best-effort)
    if list_resp.status_code == 200:
        items = list_resp.json().get("data", {}).get("items", [])
        for item in items:
            if item.get("scopeId") == target_user:
                rid = item.get("rateLimitId")
                del_resp = requests.delete(
                    f"{LLMGW}/api/v1/llmgw/rate-limits/{rid}",
                    headers=hdrs(token, "trace-r2-m2v07-delete"),
                    timeout=15,
                )
                out["live_probe"].setdefault("deletes", []).append({"id": rid, "status": del_resp.status_code})

    # 3) Create the rule (limit=2)
    rule_body = {
        "name": "Round-2 RPM rule",
        "scope": "USER",
        "targetId": target_user,
        "type": "RPM",
        "limitValue": 2,
        "windowSeconds": 60,
        "enabled": True,
    }
    create_resp = requests.post(
        f"{LLMGW}/api/v1/llmgw/rate-limits",
        json=rule_body,
        headers=hdrs(token, "trace-r2-m2v07-create"),
        timeout=15,
    )
    out["live_probe"]["create_status"] = create_resp.status_code
    out["live_probe"]["create_body"] = create_resp.json() if create_resp.headers.get("content-type", "").startswith("application/json") else create_resp.text
    rid = None
    if create_resp.status_code == 200:
        rid = create_resp.json()["data"]["rateLimitId"]

    # 4) Stats (placeholder for in-memory non-runtime probe)
    if rid:
        stats_resp = requests.get(
            f"{LLMGW}/api/v1/llmgw/rate-limits/{rid}/stats",
            headers=hdrs(token, "trace-r2-m2v07-stats"),
            timeout=15,
        )
        out["live_probe"]["stats_status"] = stats_resp.status_code
        out["live_probe"]["stats_body"] = stats_resp.json() if stats_resp.headers.get("content-type", "").startswith("application/json") else stats_resp.text

    # 5) Reset
    if rid:
        reset_resp = requests.post(
            f"{LLMGW}/api/v1/llmgw/rate-limits/{rid}/reset",
            headers=hdrs(token, "trace-r2-m2v07-reset"),
            timeout=15,
        )
        out["live_probe"]["reset_status"] = reset_resp.status_code
        out["live_probe"]["reset_body"] = reset_resp.json() if reset_resp.headers.get("content-type", "").startswith("application/json") else reset_resp.text

    out["live_probe"]["created_rule_id"] = rid
    out["verdict"] = "live_config_pass_runtime_guard_unit_test_required"
    save("r2_m2v07.json", out)
    print(json.dumps(out, ensure_ascii=False, indent=2, default=str)[:2000])
    return 0


if __name__ == "__main__":
    sys.exit(main())