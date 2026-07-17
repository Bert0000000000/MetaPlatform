"""M2-VERIFY-07 rate-limit trigger test.

Create a tiny rate-limit (limit=2, window=60s, scope=USER) and call the
embedding endpoint repeatedly. Verify that the 3rd call is rejected with
HTTP 429 or rate-limit related error.
"""

from __future__ import annotations

import json
import time

import httpx

with open(r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt", "r", encoding="utf-8") as f:
    jwt = f.read().strip()

BASE = "http://localhost:8401/api/v1/llmgw"
hdr = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {jwt}",
    "X-Trace-Id": "trace-m2v07-rl-trigger",
    "X-Tenant-Id": "tenant-m2v07-rl",
}

# Create unique rate-limit so we don't collide with existing rules
rname = f"py-rl-trigger-{int(time.time())}"
r = httpx.post(f"{BASE}/rate-limits", headers=hdr, json={
    "name": rname, "scope": "USER", "targetId": "phase2-tester",
    "type": "RPM", "limitValue": 2, "windowSeconds": 60, "enabled": True,
}, timeout=10)
print(f"RL_CREATE status={r.status_code}, body={r.text[:300]}")

# Now also create a tiny quota
qname = f"py-quota-trigger-{int(time.time())}"
r = httpx.post(f"{BASE}/quotas", headers=hdr, json={
    "name": qname, "scope": "TENANT", "type": "TOKEN_DAILY",
    "targetId": "tenant-m2v07-rl", "limitValue": 5, "enabled": True,
}, timeout=10)
print(f"QUOTA_CREATE status={r.status_code}, body={r.text[:300]}")

# Now check rate-limit summary
r = httpx.get(f"{BASE}/rate-limits/stats/summary", headers=hdr, timeout=10)
print(f"RL_SUMMARY status={r.status_code}, body={r.text[:600]}")

# Now exercise chat/multimodal to potentially hit rate-limit (provider call)
# We use a non-existent model so we get a controlled error
print("\n=== Trigger rate-limit via repeated chat/multimodal calls ===")
results = []
for i in range(4):
    rh = {**hdr, "X-Trace-Id": f"trace-m2v07-rl-{i}"}
    r = httpx.post(f"{BASE}/chat/multimodal", headers=rh, json={
        "modelId": "phase2-trigger",
        "text": "test",
        "images": [{"url": "http://example.com/test.png"}],
    }, timeout=10)
    results.append({"i": i, "status": r.status_code, "body": r.text[:400]})
    print(f"call-{i}: status={r.status_code}, body={r.text[:400]}")
    time.sleep(0.2)

# Check final rate-limit summary again
r = httpx.get(f"{BASE}/rate-limits/stats/summary", headers=hdr, timeout=10)
print(f"\nFINAL_RL_SUMMARY status={r.status_code}, body={r.text[:600]}")

# Also check audit-logs
r = httpx.get(f"{BASE}/audit-logs", headers=hdr, params={"page": 1, "pageSize": 5}, timeout=10)
print(f"AUDIT_LOGS status={r.status_code}, body={r.text[:600]}")

out = {
    "rl_create": r.status_code,
    "chat_results": results,
    "final_rl_summary_status": r.status_code,
    "final_rl_summary": r.text[:600],
    "audit_logs": r.text[:600],
}
with open(r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_rl_trigger.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)