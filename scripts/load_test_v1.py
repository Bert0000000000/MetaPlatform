"""最终冲刺 · 压测 + 性能审计探针（真实栈，容器内经网关）。

- 阶梯并发（1/4/16）× N 请求：login / ont list / reasoning 三端点
  P50/P95/错误率
- 失败注入：坏 token 401 路径延迟
输出 JSON 结果留档 docs/active/delivery/evidence/LOAD-TEST-V1.0.json
（在 mate-app-copilot 容器内执行，网络走 metaplatform 内部）。
"""
from __future__ import annotations

import json
import statistics
import time
import uuid

import httpx

GW = "http://mate-api-gateway:8100"


def login(hc: httpx.Client) -> str:
    r = hc.post(f"{GW}/api/v1/iam/auth/login",
                json={"username": "admin", "password": "admin123"})
    return r.json()["accessToken"]


def probe(hc: httpx.Client, name: str, fn, workers: int, per: int) -> dict:
    lat: list[float] = []
    errors = 0
    import threading
    lock = threading.Lock()

    def worker():
        nonlocal errors
        for _ in range(per):
            t0 = time.perf_counter()
            try:
                ok = fn(hc)
            except Exception:
                ok = False
            dt = (time.perf_counter() - t0) * 1000
            with lock:
                lat.append(dt)
                if not ok:
                    errors += 1

    threads = [threading.Thread(target=worker) for _ in range(workers)]
    t0 = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    wall = time.perf_counter() - t0
    lat.sort()

    def pct(p):
        return round(lat[min(len(lat) - 1, int(len(lat) * p))], 1)

    return {"endpoint": name, "workers": workers, "requests": len(lat),
            "p50_ms": pct(0.50), "p95_ms": pct(0.95), "p99_ms": pct(0.99),
            "errors": errors,
            "rps": round(len(lat) / wall, 1) if wall else 0}


def main() -> None:
    results: list[dict] = []
    with httpx.Client(trust_env=False, timeout=60) as hc:
        tok = login(hc)
        auth = {"Authorization": f"Bearer {tok}", "X-Tenant-Id": "tenant-default"}

        def f_login(c):
            return c.post(f"{GW}/api/v1/iam/auth/login",
                          json={"username": "admin",
                                "password": "admin123"}).status_code == 200

        def f_ont_list(c):
            return c.get(f"{GW}/api/v1/ont/v2/object-types?limit=20",
                         headers=auth).status_code == 200

        payload = {"subclass_axioms": [["a", "b"]], "individuals": {"i": ["a"]},
                   "same_as_pairs": [], "transitive_axioms": [],
                   "property_edges": []}

        def f_reasoning(c):
            return c.post(f"{GW}/api/v1/ont/v2/reasoning/run",
                          headers=auth, json=payload).status_code == 200

        def f_badtoken(c):
            return c.get(f"{GW}/api/v1/ont/v2/object-types",
                         headers={"Authorization": "Bearer bad"}).status_code == 401

        for w in (1, 4, 16):
            results.append(probe(hc, "login", f_login, w, 5))
            results.append(probe(hc, "ont_list", f_ont_list, w, 5))
            results.append(probe(hc, "reasoning", f_reasoning, w, 5))
        results.append(probe(hc, "failure_injection_badtoken", f_badtoken, 4, 5))

    out = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
           "target": GW, "results": results}
    path = "/tmp/LOAD-TEST-V1.0.json"
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for r in results:
        print(f"{r['endpoint']:<28} w={r['workers']:<3} n={r['requests']:<4} "
              f"p50={r['p50_ms']}ms p95={r['p95_ms']}ms err={r['errors']} "
              f"rps={r['rps']}")
    print("saved:", path)


if __name__ == "__main__":
    main()
