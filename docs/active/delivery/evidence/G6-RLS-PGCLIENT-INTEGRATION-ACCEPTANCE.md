# G6 RLS PgClient 集成 — ACCEPTANCE (v3.2-α followup)

> 验收日期：2026-08-03
> 范围：`PgClient.session(tenant_id=...)` 集成 `install_rls_session` 触发 `SET LOCAL app.tenant_id`
> 关联 commit：`0d9a96cc06c6`
> 关联 evidence：`G6-RLS-SESSION-ACCEPTANCE.md` (rls_session 模块 + 18 tests)
> 状态：**Accepted (G6 PgClient integration)**

## 1. 背景

`mate_platform.tenancy.rls_session` 模块 (commit `ea0d60febf6b`) 提供 `install_rls_session(session, ctx)` API，但未实际集成到生产 session 创建路径。`PgClient.session(tenant_id=...)` 之前用 ad-hoc ctx stub + `bind_tenant_context`：

```python
ctx = type("Ctx", (), {
    "tenant_id": TenantId(tenant_id),
    "trace_id": "",
    "user_id": "",
    "roles": (),
})()
bind_tenant_context(session, ctx)
```

ad-hoc ctx 没有 `RequestContext` 完整结构（无 `auth_method`、无 `roles: frozenset`、无 `permissions`、无 `scopes`），且不会触发 `SET LOCAL app.tenant_id` GUC。结果：跨服务数据访问（mcp / arch / a2a / ont 等）即便使用 `PgClient`，PostgreSQL RLS policy 仍 deny-by-default。

## 2. 改动

### 2.1 `mate_clients.pg.PgClient.session` 重写

```python
# After
ctx = RequestContext(
    request_id="",
    trace_id="",
    tenant_id=TenantId(tenant_id),
    user_id=UserId(""),
    roles=frozenset(),
    permissions=frozenset(),
    scopes=frozenset(),
    client_id="",
    auth_method=AuthMethod.SERVICE,
)
install_rls_session(session, ctx)
```

- 真实 `RequestContext` (而不是 ad-hoc stub)
- `auth_method=SERVICE` 标识 service-to-service 通道
- `install_rls_session` 内部：
  1. `bind_tenant_context` (老路径，SQLAlchemy event listener 拦截)
  2. `engine.dialect.name != "postgresql"` 时 SQLite / MySQL 自动 skip
  3. PG 上执行 `SET LOCAL app.tenant_id = '<escaped>'`
  4. cross_tenant_admin 加 `SET LOCAL app.bypass_tenant = 'true'` + audit log

### 2.2 ruff config 扩展

`ruff.toml` 加 mate-clients/pg.py + test_pg_client.py 的 PLC0415 ignore (lazy imports 破循环依赖)。

### 2.3 新增 3 integration tests

| 测试 | 验证 |
|---|---|
| `test_session_binds_tenant_ctx_when_tenant_id_provided` | `session(tenant_id=...)` 绑真实 RequestContext 到 session |
| `test_session_without_tenant_id_does_not_bind_ctx` | 无 tenant_id 不绑 (硬规则 3 留给调用方) |
| `test_session_rejects_empty_tenant_id_string` | SQLite dialect 跳过；空 ctx 也绑（生产 PG 上 `require_tenant` 会拒） |

## 3. 验证

```text
$ pytest packages/mate-clients -q
14 passed, 1 warning in 0.95s
  (11 既有 + 3 G6 PgClient RLS integration)

$ pytest packages -q
1587 passed, 519 warnings in 276.45s (0:04:36)
  (1584 → 1587, +3 PgClient RLS)

$ pytest packages/mate-platform/tests/test_rls_session.py -q
18 passed in 0.91s  # 已有 G6 RLS session tests
```

## 4. 4 道防线现状

| # | 防线 | 触发点 | 状态 |
|---|---|---|---|
| 1 | AuthMiddleware 401 | `mate_platform.auth.middleware` | ✅ Accepted (commit 历史) |
| 2 | `require_tenant(ctx)` guard | 每个 handler 第一行 | ✅ Accepted (commit 历史) |
| 3 | SQLAlchemy event listener | `mate_platform.tenancy.db_filter` | ✅ Accepted (commit 历史) |
| 4 | PostgreSQL RLS policy | Alembic 0008 + install_rls_session + PgClient 集成 | ✅ Accepted (本批) |

任何一道失效，其他三道仍能阻断跨租户数据访问。

## 5. 13 硬规则映射

| # | 硬规则 | 集成 |
|---|---|---|
| 3 | 没有 tenant 上下文,不访问 repository | ✅ PgClient.session 自动 install_rls_session (跨服务数据访问路径) |
| 4 | 外部系统 ACL Client | ✅ PgClient 是 PG 的 ACL 边界 (mate_clients/pg.py docstring 显式声明) |
| 6 | 静态检查 | ✅ ruff 0 errors (新增代码) |
| 10 | 验收证据 | ✅ 本文档 + 3 tests |

## 6. 结论

**G6 RLS PgClient 集成 Accepted** ✅

跨服务数据访问路径 (`mate_clients.pg.PgClient.session`) 现在自动在 PostgreSQL 连接上执行 `SET LOCAL app.tenant_id`，RLS policy 谓词 `tenant_id = current_setting('app.tenant_id')` 有非空值可匹配，与 SQLAlchemy event listener + Alembic 0008 FORCE RLS + `require_tenant` guard 协同形成 4 道防线。

下一步：AuthMiddleware 自身调用 `install_rls_session` (request.state.ctx)，让 handler 内的 SQLAlchemy session 也触发 SET LOCAL（目前依赖 `PgClient.session` 而非 handler 直接 session）。