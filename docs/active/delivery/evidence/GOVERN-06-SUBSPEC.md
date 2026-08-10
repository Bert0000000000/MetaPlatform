# GOVERN-06 子 Spec 索引

> 编制：2026-08-07 · 维护：MatePlatform Architecture Council
> 关联：GOVERN-06 顶层 spec + ADR-0012 + SEC-TENANT-01-ACCEPTANCE + `cozy-orbiting-wombat.md §3.3`
> 状态：**In Progress**（子 spec 拆分完成，逐项接力落地）
> 前置：GOVERN-04 Accepted（KERNEL-01 12 基元 PG 持久化补齐 — v2_kernel 9 张表已落）

## 总览

GOVERN-06 = 4 个子 spec；当前进度：✅ 子 spec-00（本文）。剩余 3 个按依赖序接力。

**偏差背景（盘点 B5）**：当前 tenant 隔离仅靠 `v2_kernel/api.py` 的 `rid.startswith(f"ont.{tenant_id}.")` 字符串前缀兜底；`PgOntologyRepository` 既未挂 `tenancy/db_filter` 事件监听器，也未挂 `tenancy/rls_session.install_rls_session`。GOVERN-04 把 12 基元全量落到 PG 后，新建的 9 张 `ont_*` 表（Alembic 0008 的 `TENANT_TABLES` 列表**漏列**这 9 张）既不在 RLS 网内，也无 engine listener——等同裸奔。

**本次收口的三层防线**（与硬规则 #3 一致）：

1. **字符串前缀兜底**：v2_kernel/api.py 现有 `rid.startswith(...)` 校验继续保留（API 层 fail-fast）
2. **PG RLS FORCE POLICY**：新建 Alembic 0013 迁移，把 9 张 KERNEL-01 v2 表加进 `tenant_isolation` 策略
3. **psycopg2 连接桥**：pg_repo 在每次开连接时执行 `SET LOCAL app.tenant_id = '<tenant>'`（参考 `rls_session.install_rls_session`，但绕过 SQLAlchemy Session，因为 PG repo 用 psycopg2 直连）

## 子 Spec 列表

| ID | 子 Spec | 范围 | 前置 | 状态 | 估计影响 tests |
|---|---|---|---|---|---:|
| ✅ 06-00 | 实施规格文档（本文） | `evidence/GOVERN-06-SUBSPEC.md` | GOVERN-04/-05 | **Accepted** | 0 |
| 06-01 | PG RLS FORCE POLICY 落地（Alembic 0013 + pg_repo psycopg2 桥） | `alembic/versions/20260802_0014_ont_kernel_rls.py` + `pg_repo.py:_connect/_execute` | 06-00 | Planned | ~10 |
| 06-02 | Helm postgresql row_security=on + API 层字符串前缀复测 | `infra/helm/charts/postgresql/templates/configmap.yaml` + `statefulset.yaml` + `v2_kernel/api.py`（已有，仅补注释） | 06-01 | Planned | 0 |
| 06-03 | test_tenant_isolation_hard.py ≥6 跨租户攻击向量 | `packages/mate-tech-ont/tests/security/` | 06-01 | Planned | ≥6 |
| 06-04 | commit + PROGRAM-BOARD 刷新 | git + `delivery/PROGRAM-BOARD.md` | 06-03 | Planned | 0 |

## 子 Spec 06-01 详细（PG RLS FORCE POLICY 落地）

### 范围

- `mate-platform-backend/alembic/versions/20260801_0013_ont_kernel_rls.py`（**新增**）
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:_connect/_cursor/各方法入口`
- 同步：`packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`（API 层字符串前缀注释强化，非逻辑变更）

### 现状盘点

```
alembic/versions/20260801_0008_tenant_rls.py:TENANT_TABLES = 62 tables
  ├─ 0001-0007: arch/copilot/a2a/data/apphub/wfe/dw/business/outbox ✅
  └─ KERNEL-01 v2 (9 张，未在列表内) ❌
       ont_object_type, ont_individual, ont_action_type, ont_link_type,
       ont_interface, ont_property, ont_link_instance, ont_axiom, ont_function
```

```
packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py
  ├─ _connect() 直连 psycopg2，无 install_rls_session 桥 ❌
  ├─ _ensure_schema() CREATE TABLE IF NOT EXISTS 创建 9 张表
  └─ 25 处 _connect() 调用，每个事务前应执行 SET LOCAL app.tenant_id
```

### 动作

#### 1) Alembic 0013 — 把 9 张 KERNEL-01 v2 表加入 `tenant_isolation` 策略

新文件 `alembic/versions/20260801_0013_ont_kernel_rls.py`：

- `revision = "0013_ont_kernel_rls"`
- `down_revision = "0012_federation_query"`（上一版是 `20260802_0013_apphub_runtime_shortlink.py`，**冲突**，需要重新规划 revision 号；本 spec 提议用 `20260807_0013_ont_kernel_rls.py` 不带序号，改用日期后缀避免覆盖）
- 复用 0008 模板：对 9 张表分别执行
  - `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY`
  - `CREATE POLICY tenant_isolation ON <t> USING (tenant_id = current_setting('app.tenant_id')::text) WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)`
  - `ALTER TABLE <t> FORCE ROW LEVEL SECURITY`
- 同样 backfill `UPDATE <t> SET tenant_id='system' WHERE tenant_id IS NULL`（防御性，虽 DDL 已 NOT NULL）
- `downgrade()` 对称撤销
- 写 **no-op on non-PostgreSQL**（与 0008 一致）

> **冲突解决**：与现有 `20260802_0013_apphub_runtime_shortlink.py` 冲突；本 spec 提议将该文件改名 `20260802_0014_apphub_runtime_shortlink.py`，新文件用 `20260807_0013_ont_kernel_rls.py`（保持 `down_revision = "0012_federation_query"`）。或：把 apphub 改成 `0014`，新文件用 `0013`。**实施时先 `alembic heads` 检查再定**。

#### 2) psycopg2 桥 — pg_repo 加 `_install_rls(conn, tenant_id)`

```python
# pg_repo.py 新增（紧跟 _connect 之后）
def _install_rls(self, conn, tenant_id: str) -> None:
    """psycopg2 版 install_rls_session —— 每次事务前设置 tenant_id GUC。

    等价于 mate_platform.tenancy.rls_session.install_rls_session，但目标
    是 psycopg2 直连（绕过 SQLAlchemy Session）。复用 rls_session 的
    转义规则（_escape_pg_string）以保持安全语义一致。
    """
    from mate_platform.tenancy.rls_session import GUC_TENANT_ID, _escape_pg_string
    safe = _escape_pg_string(tenant_id)
    with conn.cursor() as cur:
        cur.execute(f"SET LOCAL {GUC_TENANT_ID} = %s", (safe,))
```

> **修复要点**：从 f-string 改为参数化 `%s` —— 不要把 tenant_id 内嵌进 SQL，避免任何注入面（0008 的 escape 只能挡单引号，挡不住 SQL 截断）。这是 GOVERN-06 对 0008 模式的隐性硬化。

#### 3) pg_repo 入口注入 tenant_id

`PgOntologyRepository.__init__` 增加 `default tenant_id: str | None = None` 参数；在每个 `_connect()` 之后立刻 `_install_rls(conn, self._tenant_id)`；`upsert_* / get_* / list_* / apply_action / list_object_set / link_instance 操作` 共 ~25 处入口，加 `_install_rls_in_tx(conn, tenant_id)` 包装 helper。

但**更干净的方案**：把 `_connect()` 改成 `_connect(tenant_id: str)`，每个方法的开头取一次 tenant_id 并立刻 `_install_rls`。这样所有 DML 都自动带 RLS GUC，不需要改 25 个方法体。

#### 4) v2_kernel/api.py — 把 tenant_id 传给 PgOntologyRepository

`PgOntologyRepository` 在 `main.py on_startup` 实例化时**不**绑定租户（单实例）；每次 API handler 取 `ctx.tenant_id`，通过 `with self._kernel_repo.tenant_scope(ctx.tenant_id) as repo:` 上下文管理器临时绑定。

```python
# pg_repo.py 新增
from contextlib import contextmanager

@contextmanager
def tenant_scope(self, tenant_id: str):
    """GOVERN-06: 在 with 块内所有 _connect() 自动 install_rls(tenant_id)。"""
    prev = self._tenant_id
    self._tenant_id = tenant_id
    try:
        yield self
    finally:
        self._tenant_id = prev
```

`v2_kernel/api.py` 所有路由处理器统一：

```python
with app_state.kernel_repo.tenant_scope(ctx.tenant_id) as repo:
    result = repo.upsert_object_type(...)
```

### 验收

```bash
cd mate-platform-backend

# 1. 迁移成功
alembic upgrade head
#   9 张表在 psql 中：
psql -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'ont_%' AND schemaname='public';"
#   期望：rowsecurity = t 全部 9 张

# 2. 跨租户零行
psql -c "SET app.tenant_id='acme'; SELECT count(*) FROM ont_individual;"
#   期望 = acme 实际行数
psql -c "SET app.tenant_id='other'; SELECT count(*) FROM ont_individual;"
#   期望 = 0

# 3. tenant_scope 闭环
python -c "from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository; ..."
```

## 子 Spec 06-02 详细（Helm postgresql row_security=on）

### 范围

- `infra/helm/charts/postgresql/values.yaml`
- `infra/helm/charts/postgresql/templates/configmap.yaml`
- `infra/helm/charts/postgresql/templates/statefulset.yaml`

### 动作

1. `values.yaml` 加：
   ```yaml
   postgresql:
     parameters:
       row_security: "on"
   ```
   （Bitnami/postgresql 上游 chart 用 `postgresql.parameters`，裸 image 改 `postgresql.conf` ConfigMap。）
2. 因为本项目用裸 `postgres:16` image（见 `templates/statefulset.yaml`），需要：
   - 新增 `templates/postgresql-config.yaml`（ConfigMap with `postgresql.conf`）
   - `statefulset.yaml` 挂载到 `/etc/postgresql/postgresql.conf` + `--config-file` 启动参数
3. **降级路径**：dev profile（`values-local.yaml`）可设 `row_security: "off"` 并在 README 标注「dev-only；切 staging/production 前必须 on」。

### 验收

```bash
helm template infra/helm --values infra/helm/values-staging.yaml | grep -A1 'row_security\|postgresql.conf'
#   期望：ConfigMap 含 row_security = on

helm template infra/helm --values infra/helm/values-local.yaml | grep -A1 'row_security'
#   期望：off 或 dev-only 标注
```

### 子 Spec 06-01 与 06-02 的协同

Alembic 0013 是**数据库对象级**的策略（PG 角色启用 RLS）；Helm `row_security=on` 是**数据库服务级**参数（client 行为）。两者**不冲突、必须同时设置**：

- Helm 关 → client 端 `SET LOCAL app.tenant_id` 即使执行成功，policy 也不强制（除非 `FORCE`）；
- Alembic 关 → policy 创建但未 enable，`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` 缺失则整个 RLS 不生效。

所以验收脚本必须两步独立测。

## 子 Spec 06-03 详细（test_tenant_isolation_hard）

### 范围

- 新建 `packages/mate-tech-ont/tests/security/test_tenant_isolation_hard.py`
- `pytest` 默认 `mark.skipif(not _pg_available())` —— 同 `test_function_apply_e2e.py` 的 PG 探测

### 6+ 跨租户攻击向量

| ID | 攻击 | 期望 |
|---|---|---|
| T1 | `acme` 用户 SELECT 全表 `ont_individual` | 仅见 acme 的 row；其他租户行 0 |
| T2 | `acme` 用户构造 `rid="ont.other.ind.po.0"` 调 `create_individual` | raise TenantAccessError（API 层字符串前缀兜底） |
| T3 | `acme` 用户调 `apply_action(target_iid="ont.other.ind.po.0")` | raise TenantAccessError |
| T4 | `acme` 用户调 `upsert_object_type(rid="ont.other.obj.evil.v1")` | raise TenantAccessError |
| T5 | 跨租户 `link_instance` 操作（src 在 other / dst 在 acme） | raise TenantAccessError |
| T6 | 直接绕过 API 层用 `repo.tenant_scope("acme")` 写 `tenant_id='other'` 的 row | PG RLS WITH CHECK 拦截，raise psycopg2.errors.InsufficientPrivilege（或 PolicyViolation） |
| T7 | `tenant_scope("acme")` 内 SELECT 其他租户的 row | 0 行（policy USING 拦截） |
| T8 | `tenant_scope("acme")` 内 UPDATE 别人的 row | 0 行受影响（policy WITH CHECK 拦截） |

### 验收

```bash
cd mate-platform-backend
pytest packages/mate-tech-ont/tests/security/test_tenant_isolation_hard.py -v
#   期望 8 passed (PG 可用) / 8 skipped (PG 不可用)
```

### 关联 ADR

ADR-0012 §实施层（PG RLS 八表全量）+ `SEC-TENANT-01-ACCEPTANCE.md` §3 增「v2_kernel 9 表 RLS 落地」。

## 风险与缓解

| 风险 | 触发 | 缓解 |
|---|---|---|
| Alembic revision 号冲突 | 与 `20260802_0013_apphub_runtime_shortlink.py` 同号 | 实施前 `alembic heads`；改名 apphub → `0014` 或本 spec 用 `20260807_0013_ont_kernel_rls.py`（日期后缀） |
| `_install_rls` 注入 vs `_escape_pg_string` 已有 | f-string 拼接到 `SET LOCAL` 旧实现可被 SQL 截断 | 本 spec 强制改用 psycopg2 参数化 `%s`（顺带硬化 0008） |
| `tenant_scope` 上下文管理器嵌套 | 多层 API 调用内部再开 repo | 单实例 + 线程局部 `threading.local()` 兜底（实施时若测出并发问题再加） |
| dev profile 关 RLS 致 T6-T8 失败 | `values-local.yaml` 关 `row_security` | tests `skipif(not _pg_available())`；dev 用 InMemory repo（已有）规避 |
| `psycopg2.errors.InsufficientPrivilege` import 路径 | 不同 psycopg2 版本 | `from psycopg2 import errors as pg_errors` 后 `pg_errors.InsufficientPrivilege` |

## 关联 ADR / Board / Acceptance

- ADR-0012 §实施层（PG RLS 八表全量）—— 本文补到 9 表
- ADR-0021 §4（双租户上下文统一）—— `tenant_scope` 与 `install_rls_session` 双桥对齐
- `evidence/SEC-TENANT-01-ACCEPTANCE.md` §3 增 v2_kernel 9 表段
- `evidence/MP-ONT-KERNEL-01-ACCEPTANCE.md` §8 增「RLS 落地」
- `docs/active/delivery/PROGRAM-BOARD.md` GOVERN-06 行 Accepted