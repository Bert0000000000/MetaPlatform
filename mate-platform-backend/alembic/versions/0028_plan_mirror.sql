-- plan_mirror（Sprint 1A M3）：Temporal workflow ↔ legacy plan 的查询镜像表。
-- 权威状态 = Temporal history；本表只服务前端/审计查询（ADR-0061 §2.3），
-- 由 scripts/loop/reconcile_plan_mirror.py 定时对账回填。
CREATE TABLE IF NOT EXISTS plan_mirror (
    plan_id         TEXT PRIMARY KEY,          -- legacy plan_id 或 twf-* workflow id
    engine          TEXT NOT NULL,             -- temporal | legacy
    tenant_id       TEXT NOT NULL,
    author_user_id  TEXT NOT NULL DEFAULT 'system',
    status          TEXT NOT NULL,             -- submitted/running/hitl_waiting:*/completed/aborted/failed
    current_step_id TEXT,
    workflow_id     TEXT,                      -- temporal 引擎时的 workflow id
    run_id          TEXT,                      -- 最近一次 run（重启链追踪）
    step_count      INT NOT NULL DEFAULT 0,
    raw             JSONB NOT NULL DEFAULT '{}', -- 最近一次 status/review 响应快照
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_mirror_tenant_idx ON plan_mirror (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS plan_mirror_engine_idx ON plan_mirror (engine, status);

COMMENT ON TABLE plan_mirror IS
    'ADR-0061 M3 plan 镜像：只读查询投影，reconcile 脚本对账；非状态权威';
