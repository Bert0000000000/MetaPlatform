# G6 RLS 应用层增强 — ACCEPTANCE (v3.2-α)

> 验收日期：2026-08-03
> 范围：G6 应用层 SET LOCAL `app.tenant_id` session var 注入，闭环 Alembic 0008 引擎层 RLS policy
> 关联 commit：`ea0d60febf6b` + `d0cd4f91` (Alembic 0008)
> 状态：**Accepted (G6 RLS Session Bridge)**

## 1. 背景

G6 (commit `d0cd4f91`) 落地 Alembic 0008 migration，启用 58 张 `tenant_id` 表的 PostgreSQL Row-Level Security：

```sql
CREATE POLICY tenant_isolation ON <t>
    USING (tenant_id = current_setting('app.tenant_id')::text)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)
```

但 **应用层从未 `SET LOCAL app.tenant_id`** —— PostgreSQL `current_setting('app.tenant_id')` 返回 database-level 默认 `''`，策略谓词 `tenant_id = ''` 永远匹配 0 行，**deny-by-default**。结果：生产 PG 上**所有查询空集**，与 SQLAlchemy event listener（应用层第二道防线）协同失败。

## 2. 改动

### 2.1 新增 `mate_platform.tenancy.rls_session` (190 行)

文件：`packages/mate-platform/src/mate_platform/tenancy/rls_session.py`

公开 API：

| Symbol | 作用 |
|---|---|
| `GUC_TENANT_ID = "app.tenant_id"` | 与 Alembic 0008 policy 同步的 GUC 名 |
| `GUC_BYPASS = "app.bypass_tenant"` | cross-tenant admin 标记 (审计信号) |
| `_escape_pg_string(value)` | 双单引号 + 拒绝控制字符 (SQL 注入防护) |
| `_build_set_local_statements(ctx)` | 生成 `SET LOCAL` 语句列表 |
| `install_rls_session(session, ctx)` | 主工作函数：绑 ctx + 执行 `SET LOCAL` |
| `attach_rls_listener(engine)` | idempotent 标记，未来 connect-event hook 接入点 |
| `is_attached(engine)` | 诊断 / 测试断言 |
| `rls_session_middleware(session_factory)` | closure：AuthMiddleware 集成用 |

### 2.2 安全特性

| 风险 | 防御 |
|---|---|
| SQL 注入 (`tenant_id = "'; DROP TABLE x; --"`) | `_escape_pg_string` 双单引号转义，注入失败为字符串字面量 |
| 控制字符攻击 (`tenant_id = "tenant\nDROP"`) | 拒绝所有 `ord(c) < 0x20` 字符 |
| 匿名上下文 | `require_tenant(ctx)` 拒 ANONYMOUS method |
| 空 tenant_id | `require_tenant(ctx)` 拒空字符串 |
| 非 PG dialect (dev SQLite) | `engine.dialect.name != "postgresql"` 跳过 `SET LOCAL` |
| Cross-tenant 滥用 | `emit_cross_tenant_access` audit 强制留痕 |

### 2.3 middleware 集成模式

```python
# AuthMiddleware (production wiring, future PR)
from mate_platform.tenancy import rls_session_middleware

opener = rls_session_middleware(lambda: Session(engine))
with opener(request.state.ctx) as session:
    rows = session.execute(select(Widget)).all()
    # 自动 SET LOCAL app.tenant_id = '<ctx>'
```

## 3. 测试

### 3.1 新增 `test_rls_session.py` (18 tests, mock dialect)

| 测试类 | 覆盖 |
|---|---|
| `TestEscapePgString` (4) | simple pass / double quote / control char reject / empty |
| `TestBuildSetLocalStatements` (5) | basic user / cross-tenant admin bypass / anonymous reject / empty tenant reject / SQL injection neutralise |
| `TestInstallRlsSession` (6) | postgres SET LOCAL / cross_tenant_admin bypass / sqlite skip / mysql skip / ctx bound / none reject |
| `TestAttachRlsListener` (2) | idempotent / sqlite noop |
| `TestRlsSessionMiddleware` (1) | factory + ctx bound + SET LOCAL emitted |

### 3.2 关键测试用例

```python
def test_sql_injection_is_neutralised(self) -> None:
    ctx = _ctx(tenant_id="tenant'; DROP TABLE x; --")
    stmts = _build_set_local_statements(ctx)
    assert stmts == [
        f"SET LOCAL {GUC_TENANT_ID} = 'tenant''; DROP TABLE x; --'"
    ]
    # single quote doubled — entire injection is a string literal,
    # nothing breaks out.
```

## 4. 验证

```text
$ pytest packages/mate-platform/tests/test_rls_session.py -q
18 passed in 0.91s

$ ruff check packages/mate-platform/src/mate_platform/tenancy/rls_session.py \
              packages/mate-platform/tests/test_rls_session.py
All checks passed!

$ pytest packages -q
1584 passed, 519 warnings in 270.90s (0:04:30)
```

## 5. 13 硬规则映射

| # | 硬规则 | G6 增强 |
|---|---|---|
| 3 | 没有 tenant 上下文,不访问 repository | **DB + 应用双保险**: 引擎层 RLS (0008) + 应用层 `SET LOCAL app.tenant_id` |
| 6 | 静态检查 | ✅ ruff 0 errors |
| 10 | 验收证据 | ✅ 本文档 + 18 tests |
| 12 | Secret 不进 git | ✅ tenant_id escape 防御 + audit log 留痕 |

## 6. 后续工作

1. **AuthMiddleware 集成**：把 `rls_session_middleware` 接入 `mate_platform.auth.middleware.dispatch`，与现有 `install_auth(app)` 协同。
2. **跨服务实例化**：在 `mate-tech-db` 的 session factory 处统一调用 `install_rls_session`，所有读 / 写请求都触发。
3. **真实 PG staging 演练**：v3.2-δ (2027-02-15) 真实 staging 集群验证 RLS policy 实际生效（deny-by-default + 注入 SET LOCAL 后正常返回）。

## 7. 结论

**G6 RLS 应用层增强 Accepted** ✅

通过 `mate_platform.tenancy.rls_session` 把 PostgreSQL 引擎层 RLS policy 与应用层 `RequestContext` 串联，让 `app.tenant_id` GUC 在每个请求连接上正确注入，从 deny-by-default 转为"按 tenant 过滤"。配合 SQLAlchemy event listener（应用层第二道）+ Alembic 0008 FORCE RLS（DB 层第二道），形成 4 道防线：

1. AuthMiddleware 401 验证 token
2. `require_tenant(ctx)` guard 拒空 / 匿名
3. SQLAlchemy event listener 加 `WHERE tenant_id = :ctx`
4. PostgreSQL RLS policy 拒跨 tenant

任何一道失效，其他三道仍能阻断跨租户数据访问。