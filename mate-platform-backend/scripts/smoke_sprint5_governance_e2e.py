"""Sprint 5 第二批 — 治理面 + SHACL live 冒烟（网关全链，无 mock）。

链路：
  A. SHACL（ONT-G14）：① 集成路径——g21-employee 类型合成 shape，
     repo 实例 bob 验证 conforms=true；② stateless 负例——显式 individuals
     + pattern + closed → minCount/pattern/closed 违例。
  B. 治理面（DATA-D6/D7）：① lineage 边登记 + 子图；② quality 规则登记
     （required 正例 + type 反例）→ run → results 落库；③ catalog 检索。

用法：python scripts/smoke_sprint5_governance_e2e.py
前置：docker 全栈运行中（网关 8100 + mate-tech-ont + mate-tech-data）。
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
urllib.request.install_opener(_opener)

GW = "http://localhost:8100"
TENANT = "tenant-default"


def _call(
    method: str,
    path: str,
    token: str,
    payload: dict | None = None,
    tenant: str = TENANT,
    timeout: float = 30.0,
):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json", "X-Tenant-Id": tenant}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    last_exc: Exception | None = None
    for _attempt in range(3):
        req = urllib.request.Request(GW + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            try:
                return e.code, json.loads(body)
            except json.JSONDecodeError:
                return e.code, body
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_exc = e
            time.sleep(2)
    raise RuntimeError(f"{method} {path} failed after retries: {last_exc}")


def _login() -> str:
    last = ""
    for _ in range(5):
        status, body = _call(
            "POST", "/api/v1/iam/auth/login", "", {"username": "admin", "password": "admin123"}
        )
        if status == 200:
            return body["accessToken"]
        last = f"{status}"
        time.sleep(3)
    raise AssertionError(f"login failed after retries: {last}")


def main() -> int:
    token = _login()
    results: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        results.append((name, ok, detail))
        print(f"  {'PASS' if ok else 'FAIL'}: {name} {detail}", flush=True)

    emp = f"ont.{TENANT}.obj.g21-employee.v1"
    emp_name = f"ont.{TENANT}.prop.g21-name.v1"

    print("== A. SHACL（ONT-G14）==", flush=True)

    # A1 集成路径：类型合成 shape + repo 实例
    status, body = _call("POST", "/api/v1/ont/v2/shacl/validate", token, {"target_class": emp})
    a1 = status == 200 and body.get("conforms") is True
    check(
        "shacl integrated conforms (type-synth shape + stored instances)",
        a1,
        f"HTTP {status} conforms={body.get('conforms') if isinstance(body, dict) else '?'}",
    )

    # A2 stateless 负例：pattern 不匹配 + closed 多余属性
    status, body = _call(
        "POST",
        "/api/v1/ont/v2/shacl/validate",
        token,
        {
            "target_class": emp,
            "individuals": [
                {
                    "rid": "ont.tenant-default.ind.g21.bad.v1",
                    "class_rid": emp,
                    "props": {emp_name: "Bad-Name", f"ont.{TENANT}.prop.g21-extra.v1": 1},
                },
            ],
            "property_shapes": [
                {"path": emp_name, "min_count": 1, "pattern": "^[a-z]+$"},
            ],
            "closed": True,
        },
    )
    constraints = (
        {v["constraint"] for v in (body.get("violations") or [])}
        if isinstance(body, dict)
        else set()
    )
    a2 = status == 200 and body.get("conforms") is False and {"pattern", "closed"} <= constraints
    check(
        "shacl stateless negative (pattern+closed)",
        a2,
        f"HTTP {status} constraints={sorted(constraints)}",
    )

    print("== B. 治理面（DATA-D6/D7）==", flush=True)

    # B1 lineage 登记边 + 子图
    status, edge = _call(
        "POST",
        "/api/v1/data/lineage/edges",
        token,
        {
            "source_entity": "ont.x.obj.orders.v1",
            "target_entity": "ont.x.obj.orders-ads.v1",
            "edge_type": "derived_from",
        },
    )
    b1_create = status == 200 and isinstance(edge, dict) and edge.get("id")
    status, graph = _call("GET", "/api/v1/data/lineage/graph?entity=ont.x.obj.orders.v1", token)
    nodes = {n.get("id") for n in (graph or {}).get("nodes", [])}
    b1 = b1_create and status == 200 and nodes == {"ont.x.obj.orders.v1", "ont.x.obj.orders-ads.v1"}
    check("lineage edge + subgraph", b1, f"HTTP {status} nodes={sorted(nodes)}")

    # B2 quality：required 正例 + type 反例 → run → results
    status, _ = _call(
        "POST",
        "/api/v1/data/quality/rules",
        token,
        {
            "entity_id": "src-mysql-orders",
            "field": "amount",
            "rule_type": "required",
            "params": {"table": "orders"},
        },
    )
    b2_rule1 = status == 200
    status, _ = _call(
        "POST",
        "/api/v1/data/quality/rules",
        token,
        {
            "entity_id": "src-mysql-orders",
            "field": "amount",
            "rule_type": "type",
            "params": {"table": "orders", "type": "varchar(2)"},
        },
    )
    b2_rule2 = status == 200
    status, run = _call("POST", "/api/v1/data/quality/run", token, {})
    b2_run = (
        status == 200
        and run.get("rules_executed", 0) >= 2
        and run.get("passed", 0) >= 1
        and run.get("failed", 0) >= 1
    )
    status, stored = _call("GET", "/api/v1/data/quality/results", token)
    b2_stored = status == 200 and stored.get("total", 0) >= 2
    check(
        "quality rules run (required pass + type fail)",
        b2_rule1 and b2_rule2 and b2_run and b2_stored,
        f"HTTP {status} executed={run.get('rules_executed')} "
        f"passed={run.get('passed')} failed={run.get('failed')}"
        if isinstance(run, dict)
        else f"HTTP {status}",
    )

    # B3 catalog 检索（source + product 双命中）
    status, body = _call("GET", "/api/v1/data/catalog/search?q=orders", token)
    kinds = {i.get("kind") for i in (body or {}).get("items", [])}
    check(
        "catalog search hits source+product",
        status == 200 and {"source", "product"} <= kinds,
        f"HTTP {status} kinds={sorted(kinds)}",
    )

    print("\n=== SPRINT5 GOVERNANCE + SHACL E2E RESULTS ===", flush=True)
    passed = sum(1 for _, ok, _ in results if ok)
    for name, ok, detail in results:
        print(f"  {'PASS' if ok else 'FAIL'}: {name} {detail}", flush=True)
    total = len(results)
    print(f"\nTOTAL: {passed}/{total} PASS", flush=True)
    print("SPRINT5-GOV-E2E", "PASS" if passed == total else "FAIL", flush=True)
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
