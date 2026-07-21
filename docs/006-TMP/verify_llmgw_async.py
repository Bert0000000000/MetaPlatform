"""Verify TECH-LLMGW async refactoring under PostgreSQL mode.

Tests the previously-failing endpoints to confirm the async call chain fix:
- POST /api/v1/llmgw/models/sync
- GET  /api/v1/llmgw/models
- POST /api/v1/llmgw/routing/recommend   <- previously 'coroutine' object is not iterable
- POST /api/v1/llmgw/chat/completions    <- previously 'coroutine' object has no attribute 'id'
"""

from __future__ import annotations

import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000/api/v1/llmgw"
GATEWAY_LOGIN = "http://localhost:8000/api/v1/iam/auth/login"


def _post(url: str, body: dict, token: str | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"_raw": e.read().decode("utf-8", errors="replace")}


def _get(url: str, token: str | None = None) -> tuple[int, dict]:
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"_raw": e.read().decode("utf-8", errors="replace")}


def login() -> str:
    body = {"tenantId": "default", "username": "admin", "password": "Meta@12345"}
    status, payload = _post(GATEWAY_LOGIN, body)
    assert status == 200, f"login failed: {status} {payload}"
    return payload["data"]["accessToken"]


def main() -> int:
    print("=" * 72)
    print("TECH-LLMGW async refactor verification")
    print("=" * 72)

    failures: list[str] = []

    # 1) health
    status, body = _get(f"{BASE}/health")
    print(f"[1] GET /health                       -> {status}: {body}")
    if status != 200:
        failures.append("health")

    # 2) login
    token = login()
    print(f"[2] POST /iam/auth/login              -> 200 (token len={len(token)})")

    # 3) sync models
    status, body = _post(f"{BASE}/models/sync", {"providers": ["OPENAI", "VOLCENGINE"]}, token=token)
    print(f"[3] POST /models/sync                 -> {status}")
    if status == 200:
        data = body.get("data", {})
        print(f"    providers={data.get('providers')}, total={data.get('total')}")
    else:
        print(f"    body={json.dumps(body, ensure_ascii=False)[:300]}")
        failures.append("models/sync")

    # 4) list models
    status, body = _get(f"{BASE}/models", token=token)
    print(f"[4] GET /models                       -> {status}")
    if status == 200:
        data = body.get("data", {})
        items = data.get("items", [])
        print(f"    page total={data.get('total')}, items={len(items)}")
        if items:
            print(f"    first={items[0].get('provider')}/{items[0].get('modelCode')}")
    else:
        print(f"    body={json.dumps(body, ensure_ascii=False)[:300]}")
        failures.append("models list")

    # 5) routing/recommend  - previously failing with 'coroutine' object is not iterable
    status, body = _post(
        f"{BASE}/routing/recommend",
        {
            "promptTokens": 200,
            "completionTokens": 256,
            "requiredCapabilities": ["CHAT"],
            "strategy": "cheapest",
        },
        token=token,
    )
    print(f"[5] POST /routing/recommend           -> {status}")
    if status == 200:
        data = body.get("data", {})
        print(
            f"    recommended={data.get('recommendedModelId')} "
            f"provider={data.get('provider')} est_cost={data.get('estimatedCost')}"
        )
    else:
        print(f"    body={json.dumps(body, ensure_ascii=False)[:400]}")
        failures.append("routing/recommend")

    # 6) chat/completions with autoRoute (exercises optimizer + text_chat async chain)
    status, body = _post(
        f"{BASE}/chat/completions",
        {
            "messages": [{"role": "user", "content": "Hello, say hi in one short sentence."}],
            "autoRoute": True,
            "strategy": "cheapest",
            "max_tokens": 32,
        },
        token=token,
    )
    print(f"[6] POST /chat/completions (autoRoute) -> {status}")
    if status == 200:
        data = body.get("data", {})
        print(
            f"    model={data.get('model')} provider={data.get('provider')} "
            f"autoRouted={data.get('autoRouted')}"
        )
        choices = data.get("choices", [])
        if choices:
            print(f"    content={choices[0].get('message', {}).get('content')!r}")
    else:
        print(f"    body={json.dumps(body, ensure_ascii=False)[:400]}")
        failures.append("chat/completions")

    print()
    if failures:
        print(f"FAIL: {len(failures)} endpoint(s) failed: {failures}")
        return 1
    print("PASS: all LLMGW async endpoints working under PostgreSQL mode")
    return 0


if __name__ == "__main__":
    sys.exit(main())
