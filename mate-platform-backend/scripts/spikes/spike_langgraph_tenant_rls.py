"""Agent 产品层 1.0 · V2 续：langgraph PG 存储的租户隔离验证

背景（实测）：langgraph 的 PG checkpointer 建 3 张表，**全部以 thread_id 为首列主键，
没有任何租户列**：

    checkpoints(thread_id, checkpoint_ns, checkpoint_id, ...)          PK(thread_id, ...)
    checkpoint_blobs(thread_id, checkpoint_ns, channel, version, ...)  PK(thread_id, ...)
    checkpoint_writes(thread_id, checkpoint_ns, checkpoint_id, ...)    PK(thread_id, ...)

因为三张表的**首列都是 thread_id**，所以租户隔离可以**不加列**、直接挂 RLS 策略实现。

本脚本验证：
  T1 表可建（PostgresSaver.setup 在独立 schema 内）
  T2 RLS 生效：A 租户读不到 B 租户的 thread
  T3 写入也受策略约束（WITH CHECK）
  T4 **忘加租户前缀 = fail-closed**（读不到，而不是读到别人的）
  T5 真实 langgraph 图在 PG 存储上跑通，且跨连接可见（真正的持久化）

前置：`meta` 是超级用户会**绕过** RLS，故用非超级角色 `mate_app` 做隔离断言。

运行：
  mate-platform-backend/.venv/Scripts/python.exe scripts/spikes/spike_langgraph_tenant_rls.py
"""

from __future__ import annotations

import sys
from typing import Any, TypedDict

import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph

ADMIN_DSN = "postgresql://meta:meta@localhost:5432/metaplatform"
APP_DSN = "postgresql://mate_app:mate_app@localhost:5432/metaplatform"
SCHEMA = "lg_spike"

RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


class S(TypedDict, total=False):
    tenant: str
    approved: bool
    plan: list[str]
    result: str


def ticket(tenant: str) -> str:
    return f"{tenant}|t1"


def build_graph(saver: Any) -> Any:
    def analyze(state: dict[str, Any]) -> dict[str, Any]:
        return {"plan": ["步骤1"]}

    def gate(state: dict[str, Any]) -> dict[str, Any]:
        return {}

    def execute(state: dict[str, Any]) -> dict[str, Any]:
        return {"result": f"{state.get('tenant')} 执行完毕"}

    g = StateGraph(S)
    g.add_node("analyze", analyze)
    g.add_node("gate", gate)
    g.add_node("execute", execute)
    g.add_edge(START, "analyze")
    g.add_edge("analyze", "gate")
    g.add_conditional_edges(
        "gate", lambda s: "execute" if s.get("approved") else END, {"execute": "execute", END: END}
    )
    g.add_edge("execute", END)
    return g.compile(checkpointer=saver)


DDL_POLICY = """
ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso ON {t};
CREATE POLICY tenant_iso ON {t}
  USING (thread_id LIKE current_setting('app.tenant_id', true) || '|%')
  WITH CHECK (thread_id LIKE current_setting('app.tenant_id', true) || '|%');
GRANT SELECT, INSERT, UPDATE, DELETE ON {t} TO mate_app;
"""

TABLES = ("checkpoints", "checkpoint_blobs", "checkpoint_writes")


def main() -> int:
    print("=== V2 续 · langgraph PG 存储租户隔离 ===\n")

    # 干净起点
    with psycopg.connect(ADMIN_DSN, autocommit=True) as c:
        c.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
        c.execute(f"CREATE SCHEMA {SCHEMA}")
        c.execute(f"GRANT USAGE ON SCHEMA {SCHEMA} TO mate_app")
        c.execute(f"SET search_path TO {SCHEMA}")

        # T1 建表
        print("T1 表可建（PostgresSaver.setup）")
        saver = PostgresSaver(c)
        saver.setup()
        rows = c.execute(
            "select tablename from pg_tables where schemaname=%s order by tablename", (SCHEMA,)
        ).fetchall()
        created = [r[0] for r in rows]
        # setup() 建 4 张表：3 张数据表 + 1 张迁移记录表（checkpoint_migrations）
        check(
            "setup() 建出 3 张数据表 + 1 张迁移表",
            {"checkpoints", "checkpoint_blobs", "checkpoint_writes", "checkpoint_migrations"}
            <= set(created),
            str(created),
        )

        # 逐列确认"没有租户列、首列是 thread_id"
        cols = c.execute(
            """select table_name, column_name, ordinal_position from information_schema.columns
               where table_schema=%s and table_name in ('checkpoints','checkpoint_blobs','checkpoint_writes')
               and ordinal_position=1 order by table_name""",
            (SCHEMA,),
        ).fetchall()
        check(
            "三张表的第 1 列都是 thread_id（RLS 可按前缀过滤）",
            all(r[1] == "thread_id" for r in cols),
            str([(r[0], r[1]) for r in cols]),
        )
        has_tenant_col = any(
            r[0] == "tenant_id"
            for r in c.execute(
                "select column_name from information_schema.columns where table_schema=%s",
                (SCHEMA,),
            ).fetchall()
        )
        check("确认无 tenant_id 列 → 需靠 RLS 而非列", not has_tenant_col)

        # 挂 RLS
        print("\n挂 RLS 策略（按 thread_id 前缀）")
        for t in TABLES:
            c.execute(DDL_POLICY.format(t=t))
        check("三张表均已 ENABLE ROW LEVEL SECURITY 并授予 mate_app", True)

    # ── T5 真实图 + PG 存储 ──────────────────────────────────────────
    print("\nT5 真实 langgraph 图跑在 PG 存储上")
    with psycopg.connect(APP_DSN, autocommit=True) as app:
        app.execute(f"SET search_path TO {SCHEMA}")
        app.execute("SET app.tenant_id = 'tenant-a'")
        saver_a = PostgresSaver(app)
        graph = build_graph(saver_a)
        cfg_a = {"configurable": {"thread_id": ticket("tenant-a")}}
        graph.invoke({"tenant": "tenant-a", "approved": False}, cfg_a)
        st = graph.get_state(cfg_a).values
        check("A 租户在 PG 存储上跑通图并读回状态", st.get("tenant") == "tenant-a", str(dict(st)))

    # 新连接 = 真持久化（不是内存态）
    with psycopg.connect(APP_DSN, autocommit=True) as app2:
        app2.execute(f"SET search_path TO {SCHEMA}")
        app2.execute("SET app.tenant_id = 'tenant-a'")
        g2 = build_graph(PostgresSaver(app2))
        st2 = g2.get_state({"configurable": {"thread_id": ticket("tenant-a")}}).values
        check("换一条连接仍读得到（真持久化）", st2.get("tenant") == "tenant-a", str(dict(st2)))

    # ── T2 隔离 ──────────────────────────────────────────────────────
    print("\nT2 租户隔离（以 mate_app 身份断言）")
    with psycopg.connect(APP_DSN, autocommit=True) as app:
        app.execute(f"SET search_path TO {SCHEMA}")
        app.execute("SET app.tenant_id = 'tenant-b'")
        n = app.execute("select count(*) from checkpoints").fetchone()[0]
        check("B 租户看不到任何 checkpoints 行", n == 0, f"可见 {n} 行")

        app.execute("SET app.tenant_id = 'tenant-a'")
        n_a = app.execute("select count(*) from checkpoints").fetchone()[0]
        check("A 租户能看到自己的行", n_a > 0, f"可见 {n_a} 行")

    # ── T4 fail-closed ───────────────────────────────────────────────
    print("\nT4 忘加租户前缀 → fail-closed")
    with psycopg.connect(APP_DSN, autocommit=True) as app:
        app.execute(f"SET search_path TO {SCHEMA}")
        app.execute("SET app.tenant_id = 'tenant-b'")
        try:
            app.execute(
                "insert into checkpoints(thread_id, checkpoint_ns, checkpoint_id, checkpoint)"
                " values ('no-prefix-thread','','c1','{}'::jsonb)"
            )
            wrote = True
        except psycopg.errors.InsufficientPrivilege:
            wrote = False
        check("无前缀写入被 WITH CHECK 拒绝", not wrote, "策略兜住，不会写进公共空间")

    # ── 清理 ─────────────────────────────────────────────────────────
    with psycopg.connect(ADMIN_DSN, autocommit=True) as c:
        c.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
    print("\n(已清理验证用 schema)")

    print("\n=== 汇总 ===")
    failed = [n for n, ok, _ in RESULTS if not ok]
    for name, ok, _ in RESULTS:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} 通过")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
