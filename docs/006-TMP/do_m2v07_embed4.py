"""Cross-check embeddings endpoint via Python httpx (bypass PS quirks)."""

from __future__ import annotations

import json
import sys

import httpx

with open(r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt", "r", encoding="utf-8") as f:
    jwt = f.read().strip()

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {jwt}",
    "X-Trace-Id": "trace-m2v07-embed-py",
    "X-Tenant-Id": "tenant-m2v07",
}

body = {"modelId": "mock-embed", "inputs": ["test"]}

# 1) test embeddings/batch
try:
    r = httpx.post("http://localhost:8401/api/v1/llmgw/embeddings/batch", headers=headers, json=body, timeout=10)
    print(f"EMBED-BATCH status={r.status_code}")
    print(f"EMBED-BATCH body={r.text[:500]}")
except Exception as exc:
    print(f"EMBED-BATCH exc: {exc}")

# 2) test chat/multimodal (text only with no image -- should be 422)
try:
    r = httpx.post("http://localhost:8401/api/v1/llmgw/chat/multimodal", headers=headers,
                   json={"modelId": "mock", "text": "hello", "images": []}, timeout=10)
    print(f"CHAT-MM status={r.status_code}")
    print(f"CHAT-MM body={r.text[:500]}")
except Exception as exc:
    print(f"CHAT-MM exc: {exc}")