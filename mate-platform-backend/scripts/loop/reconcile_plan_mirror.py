#!/usr/bin/env python
"""reconcile_plan_mirror — Temporal history ↔ plan_mirror 对账（Sprint 1A M3）。

权威 = Temporal；镜像 = plan_mirror 表。扫描近 N 小时 twf-* workflow，
把 workflow id / run id / 状态 / query 快照 upsert 进镜像表；
engine=legacy 的行不由本脚本维护（REST 路径写入）。

用法（宿主，需 psycopg2 + temporalio）：
    python scripts/loop/reconcile_plan_mirror.py \
        --pg "postgresql://meta:meta@127.0.0.1:5432/metaplatform" \
        --temporal 127.0.0.1:7233 --hours 24
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone

UPSERT = """
INSERT INTO plan_mirror
    (plan_id, engine, tenant_id, status, workflow_id, run_id, step_count,
     raw, started_at, updated_at)
VALUES (%(plan_id)s, 'temporal', %(tenant_id)s, %(status)s, %(workflow_id)s,
        %(run_id)s, %(step_count)s, %(raw)s, %(started_at)s, now())
ON CONFLICT (plan_id) DO UPDATE SET
    status = EXCLUDED.status,
    run_id = EXCLUDED.run_id,
    step_count = EXCLUDED.step_count,
    raw = EXCLUDED.raw,
    updated_at = now()
"""


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pg", required=True)
    ap.add_argument("--temporal", default="127.0.0.1:7233")
    ap.add_argument("--hours", type=float, default=24.0)
    ap.add_argument("--limit", type=int, default=200)
    args = ap.parse_args()

    from temporalio.client import Client
    from temporalio.contrib.pydantic import pydantic_data_converter

    import psycopg2

    client = await Client.connect(args.temporal, data_converter=pydantic_data_converter)
    since = datetime.now(timezone.utc) - timedelta(hours=args.hours)
    rows = []
    async for wf in client.list_workflows(
        query=f"StartTime > '{since.isoformat()}'",
    ):
        if not (wf.id.startswith("twf-") or wf.id.startswith("outbox-")):
            continue
        desc = await client.get_workflow_handle(wf.id).describe()
        raw = json.dumps({"temporal_status": str(desc.status)}, default=str)
        _ST = {1: "running", 2: "completed", 3: "failed", 4: "cancelled",
               5: "terminated", 6: "continued_as_new", 7: "timed_out"}
        rows.append({
            "plan_id": wf.id, "tenant_id": "tenant-default",
            "status": _ST.get(int(getattr(wf, "status", 1))
                             if not isinstance(wf.status, str) else 1, "running"),
            "workflow_id": wf.id, "run_id": getattr(wf, "run_id", "") or "",
            "step_count": 0, "raw": raw,
            "started_at": wf.start_time or since,
        })
        if len(rows) >= args.limit:
            break

    conn = psycopg2.connect(args.pg)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE TABLE IF NOT EXISTS plan_mirror ("
                " plan_id TEXT PRIMARY KEY, engine TEXT NOT NULL,"
                " tenant_id TEXT NOT NULL,"
                " status TEXT NOT NULL, workflow_id TEXT, run_id TEXT,"
                " step_count INT NOT NULL DEFAULT 0,"
                " raw JSONB NOT NULL DEFAULT '{}',"
                " started_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
                " updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"
            )
            for r in rows:
                cur.execute(UPSERT, r)
        conn.commit()
    finally:
        conn.close()
    print(f"reconciled {len(rows)} temporal plans into plan_mirror")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
