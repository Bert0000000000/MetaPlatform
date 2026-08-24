# MP-V6-MIGRATION-01 — v3.0 → v6.0 数据 ETL

> **Batch 状态**：Pending Acceptance
> **优先级**：🔴 P0（v6.0 GA 必做）
> **工作量**：2-3 周
> **团队**：SRE + 后端
> **前置依赖**：MP-V6-FOUNDATION-01 + Sprint 3 启动

---

## 1. 目标

一次性 ETL：**导出 v3.0 关键数据**（用户 / 租户 / 17 域业务 / 审计日志）→ **导入 v6.0 Supabase**，实现 v6.0 冷启动。

---

## 2. 配套文档

- **ADR-0060**：完全抛弃 v3.0 数据迁移策略
- 技术架构 spec：`docs/active/specs/2026-08-19-mp-v6-architecture.md`
- 模块规划 spec：`docs/active/specs/2026-08-19-mp-v6-module-planning.md`

---

## 3. 核心原则

> **完全抛弃 v3.0 代码，仅 ETL 数据。**
> **不迁移业务逻辑（重新设计），不双写，不渐进式共存。**
> **v6.0 Schema 与 v3.0 不兼容，字段映射是单向转换。**

---

## 4. ETL 范围

### 4.1 导出（v3.0 → 中间文件）

| 数据 | 来源表 | 导出格式 | 备注 |
|---|---|---|---|
| **用户** | `users` (v3.0) | CSV（含 password hash）| 密码迁移由 Supabase Auth 处理 |
| **租户** | `tenants` (v3.0) | CSV | 仅基础信息 |
| **17 域业务数据** | 17 个 schema 表 | JSON Lines | 按 schema 映射 |
| **审计日志** | `audit_logs` (v3.0) | JSON Lines | 仅 dump 到冷存储，**不导入热库** |

### 4.2 不导出（v6.0 重建）

| 内容 | 重建方式 |
|---|---|
| Ontology 12 Kernel | v6.0 重新建模 |
| 17 域 ObjectType | v6.0 重新设计（基于 Ontology）|
| Workflow 定义 | v6.0 Temporal + workflow_configs |
| 数字员工 preset | v6.0 全新设计 |
| dsh session | v6.0 全新 |
| HITL Hub 配置 | v6.0 全新 |

### 4.3 导入（中间文件 → v6.0 Supabase）

| 数据 | 目标 | 工具 |
|---|---|---|
| 用户 | Supabase Auth `auth.users` + 业务 `users` 表 | Python script |
| 租户 | Supabase PG `tenants` 表 | Python script |
| 17 域业务数据 | Supabase PG 17 个 schema（按 v6.0 设计）| Python script + RLS |
| 审计日志 | 冷存储（S3 / OSS）| Python script |

---

## 5. 详细任务清单

### 第 1 周：导出 + Schema 映射

- [ ] 分析 v3.0 schema（17 域业务 + 用户 + 租户 + 审计）
- [ ] 写 `schema_mapping.yaml`（v3.0 → v6.0 字段映射）
- [ ] 写 `scripts/etl/export_v3_users.sql`
- [ ] 写 `scripts/etl/export_v3_tenants.sql`
- [ ] 写 `scripts/etl/export_v3_business.sql`
- [ ] 写 `scripts/etl/export_v3_audit_logs.sql`
- [ ] 在 dev 环境演练导出（验证 SQL 正确）
- [ ] 在 staging 环境演练导出（验证数据量）

### 第 2 周：导入 + 验证

- [ ] 写 `scripts/etl/import_v6_users.py`（Supabase Auth + 业务表）
- [ ] 写 `scripts/etl/import_v6_business.py`（schema 映射 + RLS）
- [ ] 写 `scripts/etl/import_v6_audit_cold.py`（冷存储归档）
- [ ] 写 `scripts/etl/verify_etl.sql`（数据一致性校验）
- [ ] 在 dev 环境演练导入
- [ ] 在 staging 环境演练导入
- [ ] 数据一致性验证（导出数 vs 导入数 vs 校验数）

### 第 3 周：生产执行 + 切流量

- [ ] 生产 ETL 执行（按租户分批切流量）
- [ ] Week 1：dev 租户切 v6.0
- [ ] Week 2：staging 租户（10% 客户）切 v6.0
- [ ] Week 3：canary 租户（1% 客户）切 v6.0
- [ ] Week 4-6：灰度 50% 客户
- [ ] Week 7：100%（全量切 v6.0）
- [ ] v3.0 标记 deprecated（仅应急）
- [ ] evidence/MP-V6-MIGRATION-01-ACCEPTANCE.md

---

## 6. 关键脚本

### 6.1 Schema 映射（`scripts/etl/schema_mapping.yaml`）

```yaml
# v3.0 → v6.0 字段映射示例

orders:
  source_table: "v3_orders"
  target_table: "orders"  # v6.0 schema
  primary_key:
    source: order_id
    target: id
    transform: "重新生成 UUID"
  fields:
    - source: tenant_id
      target: tenant_id
      transform: "INT → UUID 映射表"
    - source: customer_id
      target: customer_id
      transform: "BIGINT → UUID 映射表"
    - source: amount
      target: amount
      transform: "DECIMAL(18,2) → NUMERIC(18,2)"
    - source: status
      target: status
      transform: "VARCHAR → TEXT（值保持）"
    - source: created_at
      target: created_at
      transform: "DATETIME → TIMESTAMPTZ"
  new_fields:
    - tenant_id  # 必须新增
    - updated_at
    - idempotency_key
    # RLS policy 自动应用
```

### 6.2 导出（`scripts/etl/export_v3_users.sql`）

```sql
-- 导出用户（含密码 hash）
COPY (
  SELECT 
    id AS v3_user_id,
    username,
    email,
    password_hash,
    tenant_id AS v3_tenant_id,
    role,
    created_at,
    last_login_at
  FROM users
) TO '/tmp/etl/users.csv' WITH CSV HEADER;
```

### 6.3 导入（`scripts/etl/import_v6_users.py`）

```python
"""
导入用户到 Supabase Auth + 业务 users 表
"""
import csv
from supabase import create_client

SUPABASE_URL = "https://xxx.supabase.co"
SERVICE_KEY = "service-role-key"

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# 1. 读取 CSV
with open("/tmp/etl/users.csv") as f:
    users = list(csv.DictReader(f))

# 2. 批量创建 Supabase Auth 用户
for u in users:
    # 创建 Auth 用户（密码 hash 由 Supabase 处理）
    result = supabase.auth.admin.create_user({
        "email": u["email"],
        "password_hash": u["password_hash"],  # Supabase 支持外部 hash
        "email_confirm": True,
        "user_metadata": {
            "v3_user_id": u["v3_user_id"],
            "tenant_id": u["v3_tenant_id"],
            "role": u["role"],
        }
    })
    print(f"Created user: {u['email']}")

print(f"Imported {len(users)} users")
```

### 6.4 验证（`scripts/etl/verify_etl.sql`）

```sql
-- 验证数据一致性
SELECT 
  'users' AS table_name,
  (SELECT COUNT(*) FROM v3_users) AS v3_count,
  (SELECT COUNT(*) FROM auth.users WHERE user_metadata->>'v3_user_id' IS NOT NULL) AS v6_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM v3_users) = (SELECT COUNT(*) FROM auth.users WHERE user_metadata->>'v3_user_id' IS NOT NULL)
    THEN '✅ MATCH' ELSE '❌ MISMATCH'
  END AS status
UNION ALL
SELECT 
  'orders',
  (SELECT COUNT(*) FROM v3_orders),
  (SELECT COUNT(*) FROM orders),
  CASE 
    WHEN (SELECT COUNT(*) FROM v3_orders) = (SELECT COUNT(*) FROM orders)
    THEN '✅ MATCH' ELSE '❌ MISMATCH'
  END;
```

---

## 7. Schema 映射清单（17 域）

| 域 | v3.0 表 | v6.0 表 | 备注 |
|---|---|---|---|
| Customer | `v3_customers` | `customers` | schema 映射 |
| Order | `v3_orders` | `orders` | schema 映射 |
| Product | `v3_products` | `products` | schema 映射 |
| Contract | `v3_contracts` | `contracts` | schema 映射 |
| Supplier | `v3_suppliers` | `suppliers` | schema 映射 |
| Inventory | `v3_inventory` | `inventory` | schema 映射 |
| Finance | `v3_invoices` | `invoices` | schema 映射 |
| Expense | `v3_expenses` | `expenses` | schema 映射 |
| Document | `v3_documents` | `documents` | schema 映射 |
| Project | `v3_projects` | `projects` | schema 映射 |
| Workflow | `v3_workflows` | `workflow_configs` | schema 映射 |
| Approval | `v3_approvals` | `hitl_requests` | schema 映射 |
| Notification | `v3_notifications` | `notifications` | schema 映射 |
| User | `v3_users` | `auth.users` + `users` | Auth 用户 |
| Organization | `v3_orgs` | `orgs` | schema 映射 |
| Knowledge | `v3_articles` | `articles` | schema 映射 |
| Analytics | `v3_metrics` | `metrics` | schema 映射 |

---

## 8. 验收标准（AC）

- [ ] 4 个导出脚本写完并演练成功（dev + staging）
- [ ] 4 个导入脚本写完并演练成功（dev + staging）
- [ ] 数据一致性验证：v3.0 数 = 导入 v6.0 数
- [ ] 用户密码迁移验证（Supabase Auth 支持）
- [ ] 17 域业务数据全部导入
- [ ] 审计日志归档到冷存储
- [ ] 按租户切流量：100% 完成
- [ ] v3.0 标记 deprecated
- [ ] evidence/MP-V6-MIGRATION-01-ACCEPTANCE.md 写完
- [ ] 通知「v6.0 GA」准备就绪

---

## 9. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| **ETL 失败** | 🟠 中 | dev / staging 多次演练 + 回滚方案 |
| **切流量业务中断** | 🟠 中 | 按租户分批切 + 24h 监控 + 应急预案 |
| **用户密码迁移** | 🟡 低 | Supabase Auth 支持外部 hash / 强制重置 |
| **Schema 不一致** | 🟠 中 | 提前映射 + 测试 + 数据校验 |
| **审计日志丢失** | 🟡 低 | 归档到冷存储，保留 N 年 |

---

## 10. 下游依赖

本 Batch 完成后可启动：
- **v6.0 GA 正式发布**
- v3.0 完全退役（观察 6 个月）
- v6.1 演进（罗盘 / 应用中心 / 云市场）

---

## 11. 与 4 个 Sprint 的关系

```
Sprint 0 (Q4-2026) ─────┐
                          │
Sprint 1 (Q1-2027) ─────┤
                          ├─→  Sprint 3 末
Sprint 2 (Q1-Q2-2027) ──┤     启动 MP-V6-MIGRATION-01
                          │     （与 Sprint 3 重叠）
Sprint 3 (Q2-Q3-2027) ──┘
```

MP-V6-MIGRATION-01 在 Sprint 3 第 5 周启动，2-3 周完成。

---

## 12. 关键依赖

| 依赖 | 来源 |
|---|---|
| Supabase Auth | MP-V6-FOUNDATION-01 |
| Supabase PG | MP-V6-FOUNDATION-01 |
| 冷存储（S3 / OSS）| MP-V6-FOUNDATION-01 |
| v3.0 数据库访问 | SRE 提供只读账号 |
| v6.0 Schema | 已设计（Sprint 2 完成）|

## 13. 不做（明确反对）

- ❌ v6.0 兼容 v3.0 schema
- ❌ 双写- ❌ 渐进式共存
- ❌ 重写 Python 业务代码
- ❌ 业务逻辑迁移（业务规则重做）

---

## 14. 一句话总结

> **MP-V6-MIGRATION-01 = 一次性 ETL：导出 v3.0 4 类数据（用户 / 租户 / 17 域 / 审计日志）→ 导入 v6.0 Supabase，2-3 周完成。代码零迁移、数据零双写、按租户切流量、Sprint 3 末 v3.0 退役。**

---

*MP-V6-MIGRATION-01 完全抛弃 v3.0 数据迁移 Batch。*