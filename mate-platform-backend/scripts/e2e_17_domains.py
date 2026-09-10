"""Sprint 4 — 17 域全链路 e2e（直连端口 healthz + 网关业务 API + Temporal gRPC）。

用法：python scripts/e2e_17_domains.py
前置：docker 全栈运行中（mate-* 容器 Up + 网关 8100 + temporal 7233）。
"""
from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request

# 绕过系统代理（Windows VM 劣化时代理间歇拦截 localhost 调用）
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
urllib.request.install_opener(_opener)

GW = "http://localhost:8100"
TOKEN = ""
TID = "tenant-default"

DIRECT_HEALTH = [
    ("ont", 8007), ("llmgw", 8008), ("mcp", 8081), ("copilot", 8601),
    ("arch", 8321), ("apphub", 8301), ("orchestrator", 8505),
    ("auth", 8101), ("agent", 8002), ("rag", 8001), ("dw", 8021),
    ("msg", 8082), ("kb", 8003), ("a2a", 8502),
]
API_HEALTH = [
    ("data", 8701, "/api/v1/data/health"),
    ("etl", 8022, "/api/v1/etl/health"),
    ("scheduler", 8023, "/api/v1/scheduler/health"),
    ("metrics", 8024, "/api/v1/metrics/health"),
]


def _login() -> str:
    data = json.dumps({"username": "admin", "password": "admin123"}).encode()
    req = urllib.request.Request(
        GW + "/api/v1/iam/auth/login", data=data,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read()).get("accessToken", "")


def _direct_healthz(port: int) -> bool:
    try:
        req = urllib.request.Request(f"http://localhost:{port}/healthz")
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status == 200
    except Exception:
        return False


def _api_healthz(port: int, path: str) -> bool:
    try:
        req = urllib.request.Request(f"http://localhost:{port}{path}")
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status == 200
    except Exception:
        return False


def main() -> int:
    global TOKEN
    TOKEN = _login()
    if not TOKEN:
        print("FAIL: login"); return 1
    print(f"login OK (token {len(TOKEN)} chars)", flush=True)

    results: list[tuple[str, bool, str]] = []

    for name, port in DIRECT_HEALTH:
        ok = _direct_healthz(port)
        results.append((f"{name} healthz", ok, f"port {port}"))

    for name, port, path in API_HEALTH:
        ok = _api_healthz(port, path)
        results.append((f"{name} healthz", ok, f"port {port} {path}"))

    try:
        s = socket.create_connection(("127.0.0.1", 7233), timeout=5)
        s.close()
        results.append(("temporal gRPC", True, "port 7233"))
    except Exception as e:
        results.append(("temporal gRPC", False, str(e)[:40]))

    gw_tests = [
        ("iam login", "POST", "/api/v1/iam/auth/login",
         {"username": "admin", "password": "admin123"}),
        ("ont object-types", "GET", "/api/v1/ont/v2/object-types?limit=1", None),
        ("orchestrator roles", "GET", "/api/v1/orchestrator/roles", None),
        ("copilot agent-tools", "GET", "/api/v1/copilot/agent-tools", None),
        ("mcp tools", "GET", "/api/v1/mcp/tools", None),
        ("arch capabilities", "GET", "/api/v1/arch/capabilities", None),
        ("apphub apps", "GET", "/api/v1/apphub/apps", None),
    ]
    for name, method, path, body in gw_tests:
        try:
            data = json.dumps(body).encode() if body else None
            req = urllib.request.Request(
                GW + path, data=data,
                headers={"Content-Type": "application/json",
                         "Authorization": f"Bearer {TOKEN}",
                         "X-Tenant-Id": TID},
                method=method)
            with urllib.request.urlopen(req, timeout=15) as r:
                results.append((name, r.status == 200, f"HTTP {r.status}"))
        except Exception as e:
            results.append((name, False, str(e)[:60]))

    print("\n=== DOMAIN E2E RESULTS ===", flush=True)
    all_pass = True
    for name, ok, detail in results:
        mark = "PASS" if ok else "FAIL"
        if not ok:
            all_pass = False
        print(f"  {mark}: {name} {detail}", flush=True)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\nTOTAL: {passed}/{total} PASS")
    print("DOMAIN-E2E", "PASS" if all_pass else "FAIL", flush=True)
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
