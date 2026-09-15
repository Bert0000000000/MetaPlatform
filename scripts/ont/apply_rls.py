"""幂等应用 / 回滚 ont_* 表的 PostgreSQL RLS（F7/F8）。

**为什么需要独立脚本**：Alembic 迁移 `20260807_0013_ont_kernel_rls` 只对
**当时已存在**的表开 RLS；而 ont_* 表是服务运行时由 `pg_repo._ensure_schema()`
按需创建的。若迁移在表创建前跑过，它会静默跳过，且 **Alembic 不会重跑已应用的
revision** —— RLS 于是永久缺失（实测：``metaplatform`` 库 28 张 ont_* 表全无 RLS）。

本脚本按**实际存在的、且带 tenant_id 列**的表逐一补开，可反复执行。

前置：**部署的代码必须已修好租户传播**（`tenant_scope` 用 ContextVar 而非
threading.local）。否则服务在工作线程里拿不到 tenant → `SET LOCAL app.tenant_id`
从不执行 → 开了 RLS 之后策略拒绝所有行 → **全站读空**。

⚠️ **重要前提：应用连接角色必须不是超级用户 / BYPASSRLS**。
PostgreSQL 中**超级用户恒绕过 RLS**，`FORCE ROW LEVEL SECURITY` 只作用于表 owner，
管不住超级用户。本环境的 `meta` 角色是 `rolsuper=True, rolbypassrls=True`
（实测）—— 因此本脚本会把 26 张表开到 `rls=true force=true`，但在该角色下
**纯属装饰**，租户隔离实际**完全依赖应用层谓词/守门**。
要真正生效，须由 GOVERN-09 提供非特权应用角色。

用法：
    python scripts/ont/apply_rls.py --dsn postgresql://meta:meta@localhost:5432/metaplatform --dry-run
    python scripts/ont/apply_rls.py --dsn postgresql://meta:meta@localhost:5432/metaplatform
    python scripts/ont/apply_rls.py --dsn ... --revert     # 回滚（灭 RLS，保留策略定义）
"""

from __future__ import annotations

import argparse
import sys

try:
    import psycopg2
except ImportError:  # pragma: no cover
    print("psycopg2 required (use the backend venv)", file=sys.stderr)
    raise SystemExit(2)

DEFAULT_DSN = "postgresql://meta:meta@localhost:5432/metaplatform"
POLICY = "tenant_isolation"


def _candidate_tables(cur) -> list[str]:
    """实际存在的 ont_* 表，且含 tenant_id 列（无该列的表不适用 RLS）。"""
    cur.execute(
        """
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN information_schema.columns col
          ON col.table_schema = n.nspname
         AND col.table_name = c.relname
         AND col.column_name = 'tenant_id'
        WHERE c.relkind = 'r'
          AND n.nspname = current_schema()
          AND c.relname LIKE 'ont_%'
        ORDER BY c.relname
        """
    )
    return [r[0] for r in cur.fetchall()]


def _status(cur, tables: list[str]) -> dict[str, tuple[bool, bool]]:
    """表 → (rls_enabled, force_rls)。"""
    out: dict[str, tuple[bool, bool]] = {}
    for t in tables:
        cur.execute(
            "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = %s",
            (t,),
        )
        row = cur.fetchone()
        out[t] = (bool(row[0]), bool(row[1])) if row else (False, False)
    return out


def apply_rls(dsn: str, *, dry_run: bool = False, revert: bool = False) -> int:
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            tables = _candidate_tables(cur)
            if not tables:
                print("没有发现 ont_* 表（服务是否已启动并建表？）")
                return 1
            before = _status(cur, tables)

            for t in tables:
                if revert:
                    cur.execute(f"ALTER TABLE {t} NO FORCE ROW LEVEL SECURITY")
                    cur.execute(f"ALTER TABLE {t} DISABLE ROW LEVEL SECURITY")
                    print(f"  revert  {t}")
                    continue
                cur.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
                # PG 不支持 CREATE POLICY IF NOT EXISTS —— 先查策略是否存在
                cur.execute(
                    "SELECT 1 FROM pg_policies "
                    "WHERE schemaname = current_schema() AND tablename = %s AND policyname = %s",
                    (t, POLICY),
                )
                if cur.fetchone() is None:
                    cur.execute(
                        f"CREATE POLICY {POLICY} ON {t} "
                        "USING (tenant_id = current_setting('app.tenant_id')::text) "
                        "WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)"
                    )
                cur.execute(f"ALTER TABLE {t} FORCE ROW LEVEL SECURITY")
                enabled, forced = before[t]
                mark = "ok " if (enabled and forced) else "++ "
                print(f"  {mark}{t}")

            if dry_run:
                conn.rollback()
                print(f"\n[dry-run] {len(tables)} 张表，已回滚未提交")
                return 0
            conn.commit()

        with conn.cursor() as cur:
            after = _status(cur, tables)
        bad = [t for t, (e, f) in after.items() if (not revert and not (e and f))]
        ok = len(tables) - len(bad)
        print(f"\n{'回滚' if revert else '应用'}完成：{ok}/{len(tables)} 张表")
        if bad:
            print(f"未生效：{bad}", file=sys.stderr)
            return 1
        return 0
    finally:
        conn.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dsn", default=DEFAULT_DSN)
    ap.add_argument("--dry-run", action="store_true", help="只打印将执行的操作，不提交")
    ap.add_argument("--revert", action="store_true", help="关闭 RLS（回滚）")
    args = ap.parse_args()
    print(f"DSN: {args.dsn}{'  [dry-run]' if args.dry_run else ''}{'  [revert]' if args.revert else ''}")
    return apply_rls(args.dsn, dry_run=args.dry_run, revert=args.revert)


if __name__ == "__main__":
    raise SystemExit(main())
