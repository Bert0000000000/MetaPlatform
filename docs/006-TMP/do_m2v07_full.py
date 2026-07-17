"""M2-VERIFY-07: comprehensive LLMGW acceptance.

Tests:
1. prompts create + render
2. quotas create + list
3. rate-limits create + summary
4. models sync + embedding (with rate-limit trigger)
"""

from __future__ import annotations

import json
import sys

import httpx

with open(r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt", "r", encoding="utf-8") as f:
    jwt = f.read().strip()

BASE = "http://localhost:8401/api/v1/llmgw"
hdr = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {jwt}",
    "X-Trace-Id": "trace-m2v07-py",
    "X-Tenant-Id": "tenant-m2v07",
}

results = {}

# 1. prompts create
r = httpx.post(f"{BASE}/prompts",
               headers={**hdr, "X-Trace-Id": "trace-m2v07-py-prompt"},
               json={
                   "promptKey": "e2e_prompt_phase2_py",
                   "name": "E2E Prompt Py",
                   "template": "Hello {{name}}!",
                   "variables": [{"name": "name", "type": "string", "required": True, "defaultValue": "World"}],
                   "tags": ["e2e", "py"],
                   "category": "general",
               }, timeout=10)
results["prompt_create_status"] = r.status_code
results["prompt_create"] = r.json()
prompt_id = r.json().get("data", {}).get("promptId")

# 2. prompt render
if prompt_id:
    r = httpx.post(f"{BASE}/prompts/{prompt_id}/render",
                   headers={**hdr, "X-Trace-Id": "trace-m2v07-py-render"},
                   json={"variables": {"name": "Mate Platform"}}, timeout=10)
    results["prompt_render_status"] = r.status_code
    results["prompt_render"] = r.json()

# 3. quota create
r = httpx.post(f"{BASE}/quotas", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-quota"},
               json={
                   "name": "py-quota",
                   "scope": "TENANT",
                   "type": "TOKEN_DAILY",
                   "targetId": "tenant-m2v07",
                   "limitValue": 5000,
               }, timeout=10)
results["quota_create_status"] = r.status_code
results["quota_create"] = r.json()

# 4. quota list
r = httpx.get(f"{BASE}/quotas", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-qlist"},
              params={"scope": "TENANT", "page": 1, "pageSize": 20}, timeout=10)
results["quota_list_status"] = r.status_code
results["quota_list"] = r.json()

# 5. rate-limit create (limit=2 so 3rd call triggers)
r = httpx.post(f"{BASE}/rate-limits", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-rl"},
               json={
                   "name": "py-rl-test",
                   "scope": "USER",
                   "targetId": "phase2-tester",
                   "type": "RPM",
                   "limitValue": 2,
                   "windowSeconds": 60,
                   "enabled": True,
               }, timeout=10)
results["rl_create_status"] = r.status_code
results["rl_create"] = r.json()
rl_id = r.json().get("data", {}).get("rateLimitId")

# 6. rate-limit summary
r = httpx.get(f"{BASE}/rate-limits/stats/summary", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-rlss"}, timeout=10)
results["rl_summary_status"] = r.status_code
results["rl_summary"] = r.json()

# 7. rate-limit stats (specific rule)
if rl_id:
    r = httpx.get(f"{BASE}/rate-limits/{rl_id}/stats", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-rls"}, timeout=10)
    results["rl_stats_status"] = r.status_code
    results["rl_stats"] = r.json()

# 8. sync models
r = httpx.post(f"{BASE}/models/sync", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-sync"},
               json={"providers": ["mock"]}, timeout=10)
results["models_sync_status"] = r.status_code
results["models_sync"] = r.json()

# 9. list models
r = httpx.get(f"{BASE}/models", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-mlist"}, timeout=10)
results["models_list_status"] = r.status_code
results["models_list"] = r.json()

# 10. embedding
r = httpx.post(f"{BASE}/embeddings/batch", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-embed"},
               json={"modelId": "mock", "inputs": ["test embed"]}, timeout=10)
results["embed_status"] = r.status_code
results["embed"] = r.json()

# 11. rate-limit reset
if rl_id:
    r = httpx.post(f"{BASE}/rate-limits/{rl_id}/reset", headers={**hdr, "X-Trace-Id": "trace-m2v07-py-rlreset"}, timeout=10)
    results["rl_reset_status"] = r.status_code
    results["rl_reset"] = r.json()

with open(r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_full.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(json.dumps({k: v for k, v in results.items() if "status" in k}, indent=2))