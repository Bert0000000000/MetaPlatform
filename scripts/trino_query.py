"""Sprint5 Trino 取证辅助：python scripts/trino_query.py "SQL"

走 docker exec 内部 curl（宿主代理会截 8088），跟踪 nextUri 直到 FINISHED。
"""
from __future__ import annotations

import json
import subprocess
import sys

INNER = ('curl -s -X POST -H "X-Trino-User: mate" '
         '--data-binary @- http://localhost:8080/v1/statement')


def query(sql: str) -> dict:
    proc = subprocess.run(
        ["docker", "exec", "-i", "mate-trino", "sh", "-c", INNER],
        input=sql, capture_output=True, text=True, timeout=180)
    obj = json.loads(proc.stdout)
    rows: list = []
    while True:
        if obj.get("error"):
            raise RuntimeError(json.dumps(obj["error"], ensure_ascii=False))
        if obj.get("data"):
            rows.extend(obj["data"])
        state = obj.get("stats", {}).get("state")
        if state in ("FINISHED", "FAILED", "CANCELED"):
            return {"rows": rows, "columns": [c["name"] for c in obj.get("columns", [])],
                    "state": state}
        nxt = obj.get("nextUri")
        if not nxt:
            return {"rows": rows, "columns": [c["name"] for c in obj.get("columns", [])],
                    "state": state}
        nxt_in_container = nxt.replace("http://localhost:8080", "http://localhost:8080")
        proc = subprocess.run(
            ["docker", "exec", "mate-trino", "sh", "-c",
             f'curl -s -H "X-Trino-User: mate" "{nxt}"'],
            capture_output=True, text=True, timeout=180)
        obj = json.loads(proc.stdout)


if __name__ == "__main__":
    sql = sys.argv[1] if len(sys.argv) > 1 else "SHOW CATALOGS"
    out = query(sql)
    print(f"[{out['state']}] cols={out['columns']}")
    for r in out["rows"][:50]:
        print(tuple(r))
    if len(out["rows"]) > 50:
        print(f"... {len(out['rows'])} rows total")
