# G6 验收证据 — PostgreSQL RLS 迁移（tenant_id DB 层双保险）

> 验收日期：2026-08-01
> 范围：Alembic 0008 migration — 为所有 `tenant_id` 列的表启用 PostgreSQL Row-Level Security
> 结论：**Accepted (G6)**

## 1. 交付目标

SEC-TENANT-01 已落地"5 层租户隔离"中的 DB 层（SQLAlchemy event listener，
`tenancy/db_filter.py`）。但 PostgreSQL 本身没有 **行级安全（RLS）策略**，
若应用代码绕过 ORM（或 raw SQL 路径被意外打开），DB 引擎仍会返回跨租户数据。

G6 补齐 DB 引擎层的 RLS 策略，作为 §13 硬规则第 3 条（"没有 tenant 上下文，
不访问 repository"）的 **DB 层双保险**：即使 SQLAlchemy event listener 失效，
PostgreSQL RLS 也会在引擎层强制 `tenant_id` 隔离。

## 2. 改动清单

### 2.1 Alembic 0008 migration

`mate-platform-backend/alembic/versions/20260801_0008_tenant_rls.py`

- revision = `0008_tenant_rls`，down_revision = `0007_outbox_event`
- **dialect gating**：`op.get_bind().dialect.name != "postgresql"` 时 early return
  （SQLite / MySQL dev 不受影响，仍由 event listener 保护）。

对全部 **58 张** `tenant_id` 表（0001-0007 全量）执行：

| DDL | 作用 |
|---|---|
| `UPDATE <t> SET tenant_id='system' WHERE tenant_id IS NULL` | 既有 NULL 数据回填到 system tenant |
| `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY` | 启用 RLS |
| `CREATE POLICY tenant_isolation ON <t> USING (tenant_id = current_setting('app.tenant_id')::text) WITH CHECK (...)` | 隔离策略 + INSERT 防护 |
| `ALTER TABLE <t> FORCE ROW LEVEL SECURITY` | 强制 RLS（owner 也受策略约束，生产必须）|

Database-level default：`ALTER DATABASE "<db>" SET app.tenant_id = ''`
（确保 `current_setting` 不报错；空值 → 谓词匹配不到行 → deny-by-default）。

### 2.2 覆盖的 58 张表

| 来源 migration | 表数 | 域 |
|---|---:|---|
| 0001 baseline | 11 | arch(5) / copilot(4) / a2a(2) |
| 0002 data_platform | 5 | data(2) / etl(1) / metrics(1) / scheduler(1) |
| 0003 apphub | 5 | apphub(5) |
| 0004 wfe | 3 | wfe(3) |
| 0005 dw | 14 | dw(14) |
| 0006 business_domains | 19 | rag(2) / ont(5) / agent(3) / mcp(3) / kb(3) / llmgw(3) |
| 0007 outbox | 1 | outbox_event(1) |
| **合计** | **58** | |

### 2.3 测试

`mate-platform-backend/packages/mate-tech-db/tests/test_rls_migration.py`（6 tests）

由于本地无 PostgreSQL，使用 mock dialect 验证 migration 发出的 DDL 语句结构：

| 测试 | 验证内容 |
|---|---|
| `test_rls_enabled_on_outbox_event` | outbox_event 表有 ENABLE RLS |
| `test_rls_forced_owner_cannot_bypass` | 58 表全部有 FORCE RLS（owner 不可绕过） |
| `test_rls_cross_tenant_blocked` | 策略谓词使用 `current_setting('app.tenant_id')` + WITH CHECK |
| `test_rls_set_tenant_id_session_function` | ALTER DATABASE SET app.tenant_id = '' |
| `test_rls_disabled_in_sqlite` | SQLite 下 migration 是 no-op（0 次 op.execute） |
| `test_rls_policy_created_for_each_table` | 58 表全部有 CREATE POLICY tenant_isolation |

## 3. 13 硬规则映射

| # | 硬规则 | G6 关联 |
|---|---|---|
| 3 | **没有 tenant 上下文，不访问 repository** | **DB 层双保险**：event listener（应用层）+ RLS（引擎层）|

## 4. 测试结果

```text
$ python -m pytest packages/mate-tech-db/tests -q --tb=short
29 passed in 70.66s    # 23 既有 + 6 新增，无回归

$ python -m pytest infra/tests -q --tb=short
330 passed in 2.81s    # 无回归
```

## 5. 架构关系

```
请求层    RequestContext.tenant_id (AuthMiddleware)
    ↓
应用层    SQLAlchemy event listener (db_filter.py) — 注入 tenant_id 谓词
    ↓
引擎层    PostgreSQL RLS policy (0008_tenant_rls) — USING/WITH CHECK 强制  ← G6 新增
    ↓
数据层    tenant_id NOT NULL 列 + index
```

G6 的 RLS 是第三道防线：即使前两层（请求层 / 应用层）被绕过，
PostgreSQL 引擎仍拒绝返回不属于当前 session 的租户数据。

## 6. 已知限制

- **SQLite dev 不可用**：RLS 是 PostgreSQL 16 专有特性；dev / CI 环境（SQLite）
  仅由 event listener 保护。staging / production 部署 PG 后 RLS 自动激活。
- **session setting 依赖**：应用层必须在每个连接执行前
  `SET app.tenant_id = '<tenant>'`，否则 `current_setting` 返回空串导致
  deny-by-default（安全失败）。

## 7. 关联

- ADR-0012（全栈租户隔离 / SEC-TENANT-01）§2.1 第 2 层 DB + Alternatives B
- 13 硬规则 §13 第 3 条（DB 层双保险）
- `mate-platform/tenancy/db_filter.py`（应用层 event listener — 第一道防线）
- `alembic/versions/20260801_0001` ~ `0007`（表 schema 来源）

## 8. 结论

58 张 tenant_id 表全部启用 PostgreSQL RLS（ENABLE + POLICY + FORCE），
含 NULL 回填和 session default。新增 6 tests 全绿，回归 330 / 330 通过。
判定 **Accepted (G6)**。
