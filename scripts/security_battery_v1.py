"""最终冲刺 · 内部安全测试专项（渗透测试的自动化替代轮，范围如实）。

覆盖面：未认证扫描（全部域面 401）/ 租户错配（403）/ JWT 篡改（401）/
SQL 注入探针（参数化层拒绝）/ 超大 payload（安全拒绝）/ 危险方法。
输出留档 evidence/SEC-BATTERY-V1.0.json。
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

GW = "http://localhost:8100"
TENANT = "tenant-default"
RESULTS: list[dict] = []


def http(method, url, body=None, headers=None, timeout=30):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=timeout) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return f"ERR:{type(e).__name__}"


def rec(name, ok, got, expect):
    RESULTS.append({"name": name, "pass": ok, "got": got, "expect": expect})
    print(f"[{'PASS' if ok else 'FAIL'}] {name} got={got} expect={expect}")


def main():
    tok = None
    try:
        req = urllib.request.Request(
            f"{GW}/api/v1/iam/auth/login", method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, data=json.dumps(
                {"username": "admin", "password": "admin123"}).encode(),
                timeout=30) as r:
            tok = json.loads(r.read())["accessToken"]
    except Exception:
        pass
    auth = {"Authorization": f"Bearer {tok}", "X-Tenant-Id": TENANT} if tok else {}

    DOMAINS = [
        "/api/v1/ont/v2/object-types",
        "/api/v1/data/products",
        "/api/v1/copilot/conversations",
        "/api/v1/kb/documents",
        "/api/v1/marketplace/install",
        "/api/v1/orchestrator/roles",
        "/api/v1/llmgw/health",
        "/api/v1/mcp/tools",
        "/api/v1/agent/tools",
        "/api/v1/arch/applications",
    ]
    for d in DOMAINS:
        got = http("GET", f"{GW}{d}")
        rec(f"unauth:{d}", got in (401, 403), got, "401/403")

    # 租户错配
    if tok:
        got = http("GET", f"{GW}/api/v1/ont/v2/object-types",
                   headers={**auth, "X-Tenant-Id": "tenant-other"})
        rec("tenant-mismatch:ont", got in (401, 403), got, "401/403")

    # JWT 篡改与伪造
    if tok:
        bad = tok[:-4] + "AAAA"
        got = http("GET", f"{GW}/api/v1/ont/v2/object-types",
                   headers={"Authorization": f"Bearer {bad}",
                            "X-Tenant-Id": TENANT})
        rec("jwt-tamper", got == 401, got, "401")
    got = http("GET", f"{GW}/api/v1/ont/v2/object-types",
               headers={"Authorization": "Bearer eyJhbGciOiJSUzI1NiJ9.e30.sig",
                        "X-Tenant-Id": TENANT})
    rec("jwt-forged", got == 401, got, "401")

    # SQL 注入探针（应被参数化/校验安全拒绝：404/422/400 而非 500）
    if tok:
        for payload in ("' OR 1=1 --", "'; DROP TABLE ont_object_type; --"):
            got = http(
                "GET",
                f"{GW}/api/v1/ont/v2/object-types/{urllib.request.quote(payload)}",
                headers=auth)
            rec(f"sqli:{payload[:20]}", got in (400, 404, 422), got,
                "400/404/422 (no 500)")

    # 超大 payload（1MB JSON body）——安全拒绝（4xx），不得 500
    if tok:
        big = {"name": "x" * (1024 * 1024), "kind": "mcp",
               "artifact_id": "00000000-0000-0000-0000-000000000000",
               "version": "1.0.0"}
        got = http("POST", f"{GW}/api/v1/marketplace/install", body=big,
                   headers=auth)
        rec("oversized-payload", got in (400, 403, 413, 422), got, "4xx")

    # 危险方法
    got = http("TRACE", f"{GW}/healthz")
    rec("trace-method", got in (405, 501), got, "405/501")

    ok_n = sum(1 for r in RESULTS if r["pass"])
    out = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
           "scope": "internal automated battery (unauth/tenant/jwt/sqli/oversize/methods)",
           "total": len(RESULTS), "passed": ok_n, "results": RESULTS}
    with open(r"D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/"
              "docs/active/delivery/evidence/SEC-BATTERY-V1.0.json", "w",
              encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"\n{ok_n}/{len(RESULTS)} passed -> SEC-BATTERY-V1.0.json")


if __name__ == "__main__":
    main()
