"""SQLite → PostgreSQL 数据迁移脚本（mate-tech-iam）。

一次性脚本：把旧 SQLite mate_iam.db 中用户/角色/配置等数据迁移到 PG metaplatform_iam。
策略：
  1. PG 先 create_all 建表 + seed 重放（幂等，建立默认基线）
  2. 从 SQLite 读各表全量数据
  3. 对每张表按业务主键 upsert 到 PG（已有则跳过，仅补缺失）

用法（在容器内执行）：
    python scripts/migrate_sqlite_to_pg.py [sqlite_path]
默认 sqlite_path = /data/mate_iam.db
"""
from __future__ import annotations

import asyncio
import os
import sqlite3
import sys
from datetime import datetime

# 使包可导入（容器内 site-packages 已有，这里兜底）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 目标 PG DSN：显式指定，避免依赖运行容器的 SQLite env
PG_DSN = os.getenv(
    "IAM_MIGRATE_PG_DSN",
    "postgresql+asyncpg://meta:meta@postgres:5432/metaplatform_iam",
)
os.environ["IAM_DATABASE_URL"] = PG_DSN

from sqlalchemy import select

from mate_tech_iam.db import AsyncSessionMaker, init_db
from mate_tech_iam.domain import (
    LoginLog,
    Org,
    Permission,
    Role,
    RolePermission,
    SystemConfig,
    User,
    UserRole,
)


def _now():
    return datetime.now()


async def _run_seed() -> None:
    """PG 建表 + seed 重放默认基线。"""
    await init_db()
    from mate_tech_iam.seed import seed

    async with AsyncSessionMaker() as session:
        await seed(session, tenant_id="tenant-default")
        await session.commit()
    print("[seed] PG baseline created")


async def _migrate_configs(sqlite_path: str) -> int:
    """迁移 system_config：覆盖 PG 同名 key（保留用户修改如 MiniMax）。"""
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT tenant_id, key, value, category, label, description, "
        "value_type, enum_options, is_sensitive FROM iam_system_config"
    ).fetchall()
    conn.close()

    updated = 0
    async with AsyncSessionMaker() as session:
        existing = (
            await session.execute(select(SystemConfig))
        ).scalars().all()
        by_key = {c.key: c for c in existing}
        for r in rows:
            key = r["key"]
            cfg = by_key.get(key)
            if cfg is None:
                cfg = SystemConfig(
                    tenant_id=r["tenant_id"] or "tenant-default",
                    key=key,
                    value=str(r["value"] or ""),
                    value_type=r["value_type"] or "string",
                    category=r["category"] or "OTHER",
                    label=r["label"],
                    description=r["description"],
                    enum_options=r["enum_options"],
                    is_sensitive=bool(r["is_sensitive"]),
                )
                session.add(cfg)
            else:
                # 已有则覆盖值（保留用户修改）
                cfg.value = str(r["value"] or "")
            updated += 1
        await session.commit()
    print(f"[config] migrated {updated} system_config rows")
    return updated


async def _migrate_users(sqlite_path: str) -> int:
    """迁移用户（按 username 幂等，缺则补）。"""
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM iam_user").fetchall()
    conn.close()

    added = 0
    async with AsyncSessionMaker() as session:
        existing = (await session.execute(select(User))).scalars().all()
        by_username = {u.username: u for u in existing}
        for r in rows:
            username = r["username"]
            if username in by_username:
                continue
            cols = {c: r[c] for c in r.keys() if c not in ("id",)}
            user = User(**cols)
            session.add(user)
            by_username[username] = user
            added += 1
        await session.commit()
    print(f"[user] added {added} users")
    return added


async def main(sqlite_path: str) -> None:
    if not os.path.exists(sqlite_path):
        print(f"[skip] sqlite not found: {sqlite_path}")
        return
    await _run_seed()
    await _migrate_configs(sqlite_path)
    await _migrate_users(sqlite_path)
    print("[done] SQLite → PG migration complete")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "/data/mate_iam.db"
    asyncio.run(main(path))
