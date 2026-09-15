#!/usr/bin/env python3
"""GOVERN-09：dev 栈切换到非特权应用角色（让 RLS 真正生效）。

背景：dev 库的应用连接角色 ``meta`` 是 PostgreSQL 超级用户，**恒绕过 RLS**
—— 26+ 张 ont 表虽然 ENABLE + FORCE，实际是装饰性的，租户隔离完全压在应用层。
本脚本把 ont 域切到非特权角色 ``mate_app``（NOSUPERUSER NOBYPASSRLS），使
``FORCE ROW LEVEL SECURITY`` 真正约束读写。

为什么需要转表 owner：应用启动会跑 ``_ensure_schema()``（DDL：CREATE / ALTER /
CREATE INDEX），这些语句要求**表 owner** 或超级用户。CI 的
``prepare_ont_rls_test_db.py`` 同样做了 owner 转移（``_ensure_table_ownership``）。
owner 转移后 FORCE RLS 仍约束 owner —— 这正是 FORCE 的设计意图。

用法::

    # 切换（幂等；可重复执行）
    python scripts/ci/setup_dev_app_role.py
    # 回滚到超级用户 owner
    python scripts/ci/setup_dev_app_role.py --rollback
    # 只自检不改动
    python scripts/ci/setup_dev_app_role.py --check

切换后需要同步 compose 的 ont 域 DSN 为 ``mate_app:mate_app`` 并重启容器
（见 compose 注释）；两侧不一致时容器起不来（权限/租户语义不同）。
"""

from __future__ import annotations

import argparse
import sys

import psycopg2  # type: ignore
from psycopg2 import sql  # type: ignore

ADMIN_DSN = "postgresql://meta:meta@localhost:5432/postgres"
APP_ROLE = "mate_app"
APP_PASSWORD = "mate_app"
# dev 栈两个库都带 ont_* 表：metaplatform（历史内核路径）与
# metaplatform_ont（mate-tech-ont 容器实际 PG_DSN）。两个都要切，否则容器
# 连的那个库仍是超级用户 → RLS 依旧装饰性。
DATABASES: tuple[str, ...] = ("metaplatform", "metaplatform_ont")
# ont 域表前缀：只切本体域，不动其他域（llmgw / rag / dw … 各自独立）
TABLE_PREFIX = "ont_"


def _tables(cur: object) -> list[str]:
    cur.execute(  # type: ignore[attr-defined]
        "SELECT c.relname, pg_get_userbyid(c.relowner) FROM pg_class c "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE %s "
        "ORDER BY c.relname",
        (f"{TABLE_PREFIX}%",),
    )
    return list(cur.fetchall())  # type: ignore[attr-defined]


def _ensure_role() -> None:
    conn = psycopg2.connect(ADMIN_DSN, connect_timeout=5)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (APP_ROLE,))
            if cur.fetchone() is None:
                cur.execute(
                    sql.SQL(
                        "CREATE ROLE {} LOGIN PASSWORD %s NOSUPERUSER NOBYPASSRLS "
                        "NOCREATEDB NOCREATEROLE"
                    ).format(sql.Identifier(APP_ROLE)),
                    (APP_PASSWORD,),
                )
                print(f"created role {APP_ROLE!r}")
            else:
                cur.execute(
                    sql.SQL(
                        "ALTER ROLE {} WITH LOGIN PASSWORD %s NOSUPERUSER NOBYPASSRLS"
                    ).format(sql.Identifier(APP_ROLE)),
                    (APP_PASSWORD,),
                )
                print(f"role {APP_ROLE!r} present (re-asserted NOSUPERUSER NOBYPASSRLS)")
            for db in DATABASES:
                cur.execute(
                    sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                        sql.Identifier(db), sql.Identifier(APP_ROLE)
                    )
                )
    finally:
        conn.close()


def _grant_dml(db: str) -> None:
    conn = psycopg2.connect(f"postgresql://meta:meta@localhost:5432/{db}")
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(sql.Identifier(APP_ROLE))
            )
            for priv in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                cur.execute(
                    sql.SQL("GRANT {} ON ALL TABLES IN SCHEMA public TO {}").format(
                        sql.SQL(priv), sql.Identifier(APP_ROLE)
                    )
                )
            cur.execute(
                sql.SQL("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {}").format(
                    sql.Identifier(APP_ROLE)
                )
            )
            cur.execute(
                sql.SQL("GRANT CREATE ON SCHEMA public TO {}").format(sql.Identifier(APP_ROLE))
            )
            print(f"[{db}] granted DML + CREATE on schema public to {APP_ROLE!r}")
    finally:
        conn.close()


def _transfer_ownership(db: str, to_role: str) -> None:
    conn = psycopg2.connect(ADMIN_DSN, dbname=db)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for table, owner in _tables(cur):
                if owner == to_role:
                    continue
                cur.execute(
                    sql.SQL("ALTER TABLE {} OWNER TO {}").format(
                        sql.Identifier(table), sql.Identifier(to_role)
                    )
                )
            print(f"[{db}] {TABLE_PREFIX}* tables owner → {to_role!r} (FORCE RLS 仍约束 owner)")
    finally:
        conn.close()


def _install_rls(db: str) -> None:
    """给该库全部 ont_* 表装租户隔离策略（ENABLE + POLICY + FORCE）。

    语义与 ``scripts/ci/prepare_ont_rls_test_db.py`` 的 ``_ensure_schema_and_rls``
    一致：``tenant_id = current_setting('app.tenant_id')``。仅对有 tenant_id
    列的表生效（无该列的表跳过并列出）。
    """
    conn = psycopg2.connect(ADMIN_DSN, dbname=db)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE %s ORDER BY 1",
                (f"{TABLE_PREFIX}%",),
            )
            tables = [r[0] for r in cur.fetchall()]
            cur.execute(
                sql.SQL("ALTER DATABASE {} SET app.tenant_id = ''").format(sql.Identifier(db))
            )
            skipped: list[str] = []
            for table in tables:
                cur.execute(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=%s AND column_name='tenant_id'",
                    (table,),
                )
                if cur.fetchone() is None:
                    skipped.append(table)
                    continue
                cur.execute(
                    sql.SQL("ALTER TABLE {} ENABLE ROW LEVEL SECURITY").format(sql.Identifier(table))
                )
                cur.execute(
                    sql.SQL("DROP POLICY IF EXISTS tenant_isolation ON {}").format(
                        sql.Identifier(table)
                    )
                )
                cur.execute(
                    sql.SQL(
                        "CREATE POLICY tenant_isolation ON {} "
                        "USING (tenant_id = current_setting('app.tenant_id')::text) "
                        "WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)"
                    ).format(sql.Identifier(table))
                )
                cur.execute(
                    sql.SQL("ALTER TABLE {} FORCE ROW LEVEL SECURITY").format(sql.Identifier(table))
                )
            print(f"[{db}] RLS installed on {len(tables) - len(skipped)}/{len(tables)} tables"
                  + (f"; skipped (no tenant_id): {skipped}" if skipped else ""))
    finally:
        conn.close()


def _check_db(db: str) -> list[str]:
    failures: list[str] = []
    app_dsn = f"postgresql://{APP_ROLE}:{APP_PASSWORD}@localhost:5432/{db}"
    try:
        conn = psycopg2.connect(app_dsn, connect_timeout=5)
    except Exception as e:
        print(f"[{db}] FAIL: 非特权角色无法连接：{e}")
        return [f"{db}: 连接失败"]
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
            )
            user, is_super, bypass = cur.fetchone()
            if is_super or bypass:
                failures.append(f"{db}: 应用角色仍是特权角色 —— RLS 会被绕过")

            cur.execute("SET app.tenant_id = 'definitely-not-a-tenant'")
            cur.execute("SELECT count(*) FROM ont_individual")
            cross = cur.fetchone()[0]
            cur.execute("SET app.tenant_id = 'tenant-default'")
            cur.execute("SELECT count(*) FROM ont_individual")
            own = cur.fetchone()[0]
            print(f"[{db}] role={user} super={is_super} bypass={bypass} "
                  f"cross-tenant-rows={cross} own-tenant-rows={own}")
            if cross != 0:
                failures.append(f"{db}: 跨租户可读 {cross} 行 —— RLS 未生效")
            if own == 0:
                failures.append(f"{db}: 本租户读不到自己的数据（tenant-default）")

            for ddl in (
                "CREATE TABLE IF NOT EXISTS ont_individual (rid TEXT)",
                "ALTER TABLE ont_individual ADD COLUMN IF NOT EXISTS provenance JSONB NULL",
            ):
                try:
                    cur.execute(ddl)
                except Exception as e:
                    first = str(e).strip().splitlines()[0]
                    failures.append(f"{db}: DDL 权限不足（容器 bootstrap 会失败）：{first}")
                    break
    finally:
        conn.close()
    return failures


def _check() -> int:
    failures: list[str] = []
    for db in DATABASES:
        failures.extend(_check_db(db))

    if failures:
        print("\nCHECK FAILED:")
        for f in failures:
            print("  -", f)
        return 1
    print("\nCHECK PASSED: 非特权角色 + RLS 真拦截 + DDL 权限齐备（两库）")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rollback", action="store_true", help="把 ont_* 表 owner 还给 meta")
    parser.add_argument("--check", action="store_true", help="只自检，不做改动")
    args = parser.parse_args()

    if args.check:
        return _check()
    if args.rollback:
        for db in DATABASES:
            _transfer_ownership(db, "meta")
        print("回滚完成：记得把 compose 的 ont 域 DSN 改回 meta:meta 并重启容器")
        return 0

    _ensure_role()
    for db in DATABASES:
        _grant_dml(db)
        _transfer_ownership(db, APP_ROLE)
        _install_rls(db)
    rc = _check()
    if rc == 0:
        print(
            "\n下一步：把 compose（根 + worktree 双份）ont 域 PG_DSN 改为 "
            f"postgresql://{APP_ROLE}:{APP_PASSWORD}@postgres:5432/${{ONT_DB}}，"
            "然后 docker restart mate-tech-ont 并探活网关。"
        )
    return rc


if __name__ == "__main__":
    sys.exit(main())
