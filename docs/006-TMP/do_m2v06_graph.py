"""M2-VERIFY-06: RAG enhanced endpoints.

Tests:
1. graph-search
2. context/assemble
3. citations/locate
"""

from __future__ import annotations

import json

import httpx

with open(r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt", "r", encoding="utf-8") as f:
    jwt = f.read().strip()

BASE = "http://localhost:8901/api/v1/rag"
hdr = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {jwt}",
    "X-Trace-Id": "trace-m2v06-graph",
    "X-Tenant-Id": "tenant-m2v06",
}

results = {}

# 1. graph-search
r = httpx.post(f"{BASE}/graph-search", headers={**hdr, "X-Trace-Id": "trace-m2v06-gs"},
               json={"query": "test graph search", "knowledgeBaseId": "kb-test", "depth": 1, "topK": 5},
               timeout=15)
results["graph_search_status"] = r.status_code
results["graph_search"] = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text[:500]

# 2. context assemble
r = httpx.post(f"{BASE}/context/assemble", headers={**hdr, "X-Trace-Id": "trace-m2v06-ctx"},
               json={
                   "query": "summarize Phase 2 RAG",
                   "knowledgeBaseIds": ["kb-test"],
                   "conversationHistory": [],
                   "contextConfig": {"maxTokens": 2048, "includeOntology": True, "includeRag": True, "includeConversation": True},
               },
               timeout=15)
results["context_assemble_status"] = r.status_code
results["context_assemble"] = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text[:500]

# 3. citations locate
r = httpx.post(f"{BASE}/citations/locate", headers={**hdr, "X-Trace-Id": "trace-m2v06-cit"},
               json={"query": "test", "chunkIds": ["chunk-1"]}, timeout=15)
results["citations_locate_status"] = r.status_code
results["citations_locate"] = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text[:500]

# 4. Also try knowledge-bases CRUD (since graph-search needs an existing kb)
r = httpx.post(f"{BASE}/knowledge-bases", headers={**hdr, "X-Trace-Id": "trace-m2v06-kb"},
               json={"name": "Phase 2 KB", "description": "Phase 2 acceptance KB"}, timeout=15)
results["kb_create_status"] = r.status_code
results["kb_create"] = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text[:500]

# 5. List kbs
r = httpx.get(f"{BASE}/knowledge-bases", headers={**hdr, "X-Trace-Id": "trace-m2v06-kbls"},
              params={"page": 1, "pageSize": 10}, timeout=15)
results["kb_list_status"] = r.status_code
results["kb_list"] = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text[:500]

with open(r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v06_rag.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

for k, v in results.items():
    if "status" in k:
        print(k, "=", v)