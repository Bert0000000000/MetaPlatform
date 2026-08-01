# G6 RLS 迁移需求规范

> 版本:v1.0 · 2026-08-01
> 关联:`ADR-0012-sec-tenant-isolation.md` + `production-readiness-design.md §13` + `TD-5-ACCEPTANCE.md`
> 状态:**Active**(供 P3-W11 code 模式做 Alembic 0008)
> 修订人:需求层(TRAE)

---

## 1. 背景与目标

### 1.1 背景

§13 硬规则 3 要求「没有 tenant 上下文,不访问 repository」。当前(v3.0 GA 收口)通过两层机制保证:

1. **应用层**:`mate_platform.tenancy.guards.require_tenant(ctx)`(每个 handler 第一行调用)
2. **ORM 层**:`mate_platform.tenancy.db_filter` SQLAlchemy event listener(自动给 SQL 加 `WHERE tenant_id = :tenant_id`)

**但应用层有缺陷**:若代码绕过 ORM listener(裸 SQL / 直连 PG / SQLAlchemy 关闭 filter),**tenant 隔离就失效**。这是 §13 硬规则的真实风险。

### 1.2 目标

**G6 = 数据库原生 RLS**(Row Level Security)在已有的 4 张主表上加 tenant 隔离策略,作为应用层防御的**第二道防线**:

- 即便应用层 ORM listener 被绕过,PG RLS 也会阻断跨 tenant 数据访问
- 与现有 `mate_platform.tenancy.db_filter` 配合(应用层 + 数据库层双重防护)
- 配套 `tenant_id` 列回填脚本,确保历史数据带正确 tenant

### 1.3 与 TD-5 的关系

- **TD-5**(已 Accepted):10 域 in-memory → PostgreSQL 持久化,主表已具备 `tenant_id` 列
- **G6**(本规范):在 TD-5 基础上,**升级 PG 原生 RLS**,不只是应用层 listener

---

## 2. 范围

### 2.1 必须 RLS 的主表(4 张)

按 §13 硬规则 3 + 数据敏感度:

| 表 | 域 | 敏感度 | 已有 tenant_id | 需要 RLS |
|---|---|---|---|---|
| `mate_platform.kb_documents` | kb / rag | 高 | ✅ TD-5 落地 | ✅ |
| `mate_platform.rag_chunks` | rag | 高 | ✅ TD-5 落地 | ✅ |
| `mate_platform.ont_classes` | ont | 中 | ✅ TD-5 落地 | ✅ |
| `mate_platform.ont_instances` | ont | 中 | ✅ TD-5 落地 | ✅ |

### 2.2 必须回填 tenant_id 的表(7 张)

历史 in-memory 数据迁移到 PG 后,部分行可能缺 `tenant_id`(TD-5 没强制 NOT NULL),需回填:

| 表 | tenant_id 来源 | 默认值 |
|---|---|---|
| `mate_platform.kb_documents` | doc_id → 反查 KB → tenant | `TBD`(需脚本生成) |
| `mate_platform.rag_chunks` | doc_id → KB → tenant | 同上 |
| `mate_platform.ont_classes` | ontology_id → tenant | 同上 |
| `mate_platform.ont_instances` | class_id → ontology → tenant | 同上 |
| `mate_platform.dw_employees` | employee_id → tenant(从 owner) | `default_tenant` |
| `mate_platform.apphub_apps` | app_id → owner tenant | `default_tenant` |
| `mate_platform.arch_apps` | app_id → owner tenant | `default_tenant` |

> 默认 tenant(`default_tenant`)由 Keycloak realm 一开始就建好的 system tenant,迁移期所有孤儿数据归到这个 tenant,后续运营清理。

### 2.3 必须做迁移审计的表(所有表)

- `mate_platform.alembic_version`(跟踪迁移进度)
- `mate_platform.rls_migration_audit`(新增,记录每行迁移前后的 tenant_id)

---

## 3. 数据模型变更

### 3.1 列变更(必须)

```sql
-- 1. tenant_id 改为 NOT NULL + DEFAULT
ALTER TABLE mate_platform.kb_documents
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT 'default_tenant';

-- 2. 加租户隔离索引
CREATE INDEX CONCURRENTLY idx_kb_documents_tenant_id
  ON mate_platform.kb_documents (tenant_id);
```

### 3.2 RLS 策略(必须)

```sql
-- 启用 RLS
ALTER TABLE mate_platform.kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE mate_platform.kb_documents FORCE ROW LEVEL SECURITY;

-- 策略:仅允许 tenant_id 等于当前会话变量的行
CREATE POLICY kb_documents_tenant_isolation ON mate_platform.kb_documents
  USING (tenant_id = current_setting('mate.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('mate.tenant_id', true));

-- 对 service_role 跳过(后台任务如 outbox relay)
CREATE POLICY kb_documents_service_bypass ON mate_platform.kb_documents
  TO mate_service_role
  USING (true)
  WITH CHECK (true);
```

### 3.3 会话变量注入(必须)

每个请求进入 handler 时,中间件 `install_auth(app)` 会设置:

```sql
SET LOCAL mate.tenant_id = '<tenant_id>';
```

实现位置:`packages/mate-platform/src/mate_platform/auth/middleware.py`(在 `request.state.ctx` 注入前)。

---

## 4. 关键业务规则

### 4.1 跨租户 admin 通道

`cross_tenant_admin` 角色的查询不应用 RLS 限制,通过显式声明 `SET LOCAL mate.bypass_tenant = 'true'` 触发:

```sql
SET LOCAL mate.tenant_id = 'admin_tenant';
SET LOCAL mate.bypass_tenant = 'true';
```

`SEC-TENANT-01` 已实现 `cross_tenant_admin` 审计,该角色所有跨租户查询自动写到 audit log。

### 4.2 写入规则

新插入数据必须满足:`tenant_id = current_setting('mate.tenant_id')`,否则 INSERT 失败(RLS WITH CHECK 约束)。

不允许**孤儿 tenant_id**(即 tenant_id 在 `mate_platform.tenants` 注册表里不存在)的写入。代码侧 handler 必须先校验 tenant 有效再写。

### 4.3 service_role 使用范围

`mate_service_role` PG 角色只能用于:

- **Outbox relay**(`mate_platform.messaging.outbox.relay`)— 跨租户读 outbox_event 表
- **Audit log writer**(`mate_platform.observability.audit`)— 写 audit_log 表
- **数据迁移脚本**(Alembic 迁移期间)— 临时 GRANT,迁移完成 REVOKE

不允许业务 handler 使用 service_role。

### 4.4 回滚策略

```sql
-- RLS 关闭(紧急)
ALTER TABLE mate_platform.kb_documents DISABLE ROW LEVEL SECURITY;

-- tenant_id NOT NULL 取消
ALTER TABLE mate_platform.kb_documents
  ALTER COLUMN tenant_id DROP NOT NULL;
```

回滚 SOP:运维在 5 分钟内 ROLLBACK Alembic 0008,运维团队演练。

### 4.5 跨租户统计(BI / admin 通道)

BI 报表需要跨租户统计时:

- 使用 `mate_service_role` 角色(单独 GRANT)
- 走 audit log(每次跨租户查询必须留痕)
- 不绕过应用层(必须通过 `/api/v1/admin/*` endpoint,不允许直连 PG)

---

## 5. 实施步骤(给 code 模式)

### 步骤 1:Alembic 0008 migration 脚本

文件:`packages/mate-tech-db/alembic/versions/0008_rls_tenant.py`

```python
"""RLS tenant isolation migration.

Adds:
1. ALTER tenant_id SET NOT NULL + DEFAULT for 4 main tables
2. ENABLE + FORCE ROW LEVEL SECURITY
3. CREATE POLICY for tenant isolation
4. CREATE POLICY for service_role bypass
5. CREATE INDEX on tenant_id for each table

Revision ID: 0008
Revises: 0007 (outbox_event from G3)
Create Date: 2026-08-01
"""

# 在 down_revision = "0007"

def upgrade() -> None:
    # 1. 回填 tenant_id(孤儿归 default_tenant)
    op.execute("""
        UPDATE mate_platform.kb_documents
        SET tenant_id = 'default_tenant'
        WHERE tenant_id IS NULL OR tenant_id NOT IN (
          SELECT tenant_id FROM mate_platform.tenants
        );
    """)
    # ... 同样对 4 张表

    # 2. NOT NULL + DEFAULT
    for table in ['kb_documents', 'rag_chunks', 'ont_classes', 'ont_instances']:
        op.execute(f"ALTER TABLE mate_platform.{table} ALTER COLUMN tenant_id SET NOT NULL;")
        op.execute(f"ALTER TABLE mate_platform.{table} ALTER COLUMN tenant_id SET DEFAULT 'default_tenant';")
        op.execute(f"CREATE INDEX CONCURRENTLY idx_{table}_tenant_id ON mate_platform.{table} (tenant_id);")

    # 3. RLS
    for table in ['kb_documents', 'rag_chunks', 'ont_classes', 'ont_instances']:
        op.execute(f"ALTER TABLE mate_platform.{table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE mate_platform.{table} FORCE ROW LEVEL SECURITY;")
        op.execute(f"""
            CREATE POLICY {table}_tenant_isolation ON mate_platform.{table}
            USING (tenant_id = current_setting('mate.tenant_id', true))
            WITH CHECK (tenant_id = current_setting('mate.tenant_id', true));
        """)
        op.execute(f"""
            CREATE POLICY {table}_service_bypass ON mate_platform.{table}
            TO mate_service_role
            USING (true) WITH CHECK (true);
        """)

def downgrade() -> None:
    # 反向:删 policy → 关 RLS → 取消 NOT NULL
    ...
```

### 步骤 2:中间件更新

文件:`packages/mate-platform/src/mate_platform/auth/middleware.py`

```python
# 在 install_auth 注入 tenant 上下文时,同步设置 PG 会话变量
async def set_tenant_context(conn, tenant_id: str):
    await conn.execute("SET LOCAL mate.tenant_id = %s", tenant_id)
```

### 步骤 3:测试用例

文件:`packages/mate-tech-db/tests/test_rls_tenant.py`

```python
import pytest
from sqlalchemy import create_engine, text

def test_rls_tenant_isolation_blocks_cross_tenant():
    """tenant A 创建数据后,以 tenant B 连接,不应看到。"""
    engine_a = create_engine(URL_A)
    engine_b = create_engine(URL_B)

    # tenant A 插入
    with engine_a.connect() as conn:
        conn.execute(text("SET LOCAL mate.tenant_id = 'tenant-a'"))
        conn.execute(text("INSERT INTO kb_documents (id, tenant_id, content) VALUES ('doc1', 'tenant-a', 'secret')"))
        conn.commit()

    # tenant B 查询,应看不到 doc1
    with engine_b.connect() as conn:
        conn.execute(text("SET LOCAL mate.tenant_id = 'tenant-b'"))
        result = conn.execute(text("SELECT id FROM kb_documents WHERE id = 'doc1'"))
        assert result.fetchone() is None, "RLS 失败:tenant B 看到了 tenant A 的数据"

def test_rls_service_role_can_see_all():
    """service_role 应能跨租户查询(用于后台任务)。"""
    with engine_service.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM kb_documents"))
        assert result.fetchone()[0] >= 1

def test_rls_blocks_orphan_insert():
    """插入 tenant_id = 'invalid-tenant' 应被 WITH CHECK 拒绝。"""
    with engine_a.connect() as conn:
        conn.execute(text("SET LOCAL mate.tenant_id = 'invalid-tenant'"))
        with pytest.raises(ProgrammingError):
            conn.execute(text("INSERT INTO kb_documents (id, tenant_id) VALUES ('doc2', 'invalid-tenant')"))
```

---

## 6. 验收标准(给 code 模式)

### 6.1 必须通过的验证

| 验证项 | 工具 | 标准 |
|---|---|---|
| Alembic 0008 升级 | `alembic upgrade head` | exit 0,无报错 |
| Alembic 0008 降级 | `alembic downgrade -1` | exit 0 |
| 4 张主表 RLS 启用 | `pg_dump --schema-only` | 输出含 `ENABLE ROW LEVEL SECURITY` |
| RLS 隔离 | pytest:test_rls_tenant_isolation_blocks_cross_tenant | 通过 |
| service_role 旁路 | pytest:test_rls_service_role_can_see_all | 通过 |
| WITH CHECK 约束 | pytest:test_rls_blocks_orphan_insert | 通过 |
| 跨租户 audit | 手动验证 | `cross_tenant_admin` 查询写入 audit_log |
| 性能 | `EXPLAIN ANALYZE` | 单表查询 P95 < 10ms(RLS 开销) |
| 全后端回归 | `pytest packages/` | 1304 + tests 通过 |

### 6.2 13 硬规则对齐

| # | 硬规则 | 状态 | 证据 |
|---|---|---|---|
| 3 | 没有 tenant 上下文不访问 repository | ✅ **更强** | 应用层 listener + 数据库 RLS 双重 |
| 5 | Production profile 禁止 fallback | ✅ | mate_service_role 受限使用 |
| 9 | 没有审计、指标、trace | ✅ | 跨租户查询走 audit_log |
| 10 | 所有状态以验收证据为准 | ✅ | 本规范 + ACCEPTANCE.md |

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 性能开销(每行 RLS 检查) | 单表查询慢 1-5ms | 在 tenant_id 列建覆盖索引;P95 < 10ms |
| 历史数据缺 tenant_id | 应用层 listener 也会失效 | 7 张表回填脚本,孤儿归 default_tenant |
| service_role 误用 | 跨租户数据泄漏 | 仅限 Outbox / Audit / Alembic GRANT,业务代码禁止 |
| RLS 策略绕过 | 跨租户数据访问 | FORCE ROW LEVEL SECURITY(table owner 也不能绕过) |
| 回滚困难 | 应用层 + DB 层双重失效后,需立即回滚 | 5 分钟 ROLLBACK SOP,运维演练 |

---

## 8. 后续 PR 计划

```
PR #N (P3-W11 — G6):
  - 新建: packages/mate-tech-db/alembic/versions/0008_rls_tenant.py
  - 改:   packages/mate-platform/src/mate_platform/auth/middleware.py (注入 SET LOCAL)
  - 新建: packages/mate-tech-db/tests/test_rls_tenant.py
  - 文档: docs/active/delivery/evidence/G6-RLS-MIGRATION-ACCEPTANCE.md
  - 回滚: 配套 rollback runbook(5 分钟 SOP)
```

---

## 9. 关联文档

- `ADR-0012-sec-tenant-isolation.md` — 5 层隔离
- `production-readiness-design.md §13` — 硬规则
- `TD-5-ACCEPTANCE.md` — 10 域 in-memory → PostgreSQL
- `mate-platform/auth/` — install_auth 中间件
- `mate-platform/tenancy/db_filter.py` — 应用层 listener
- `PROGRAM-BOARD.md` — G6 状态

---

## 10. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-01 | v1.0 初版(4 张主表 RLS + 7 张表 tenant_id 回填 + 实施步骤) | 需求层(TRAE) |