# G3 + G7 硬规则收口验收证据

> **验收日期**: 2026-08-01
> **批次**: v3.1 增量收口（GA 硬规则 G3 / G7）
> **关联 ADR**: ADR-0013 §2.1（Outbox schema）/ ADR-0010 §4.3（SealedSecrets 备份）
> **结论**: **G3 Accepted** / **G7 Accepted**

---

## 1. 交付目标

| 项 | G3 | G7 |
|---|---|---|
| **来源** | PROGRAM-BOARD G3: Outbox DDL 迁移 | PROGRAM-BOARD G7: SealedSecrets 主私钥异地备份 runbook |
| **硬规则** | §13 第 9 条（审计/指标/trace 闭环）| §13 第 12 条（Secret 不进 git）|
| **目标** | `outbox_event` 表 Alembic 迁移，覆盖 ADR-0013 定义的 schema + tenant_id NOT NULL + 5 索引 | SealedSecrets 主私钥异地备份 + 恢复 + 季度演练 runbook |

---

## 2. 改动文件清单

### G3 — Outbox DDL 迁移

| 文件 | 类型 | 说明 |
|---|---|---|
| `mate-platform-backend/alembic/versions/20260801_0007_outbox_event.py` | 新建 | Alembic 迁移 0007，创建 `outbox_event` 表（11 字段 + 5 索引）|
| `mate-platform-backend/packages/mate-tech-db/tests/test_outbox_migration.py` | 新建 | 6 个测试覆盖表结构 + 索引 + 默认值 + 降级 |

### G7 — SealedSecrets 备份 runbook

| 文件 | 类型 | 说明 |
|---|---|---|
| `docs/active/runbooks/sealed-secret-backup.md` | 新建 | 备份 + 恢复 + 演练 + 责任人 runbook |
| `docs/active/runbooks/sealed-secret-backup-inventory.md` | 新建 | 备份清单模板（备份记录 + 演练日志 + 审计追踪）|

### 验收文档

| 文件 | 类型 | 说明 |
|---|---|---|
| `docs/active/delivery/evidence/G3-G7-ACCEPTANCE.md` | 新建 | 本文件 |

---

## 3. G3 — outbox_event 表 schema

### 字段（11 列）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | String(64) | PK | 事件 ID (UUID v4) |
| `tenant_id` | String(64) | NOT NULL, INDEX | 租户 ID（SEC-TENANT-01 §13 第 3 条）|
| `aggregate_type` | String(128) | NOT NULL | 聚合根类型（如 `order`）|
| `aggregate_id` | String(128) | NOT NULL | 聚合根 ID |
| `event_type` | String(128) | NOT NULL, INDEX | 事件类型（如 `order.created`）|
| `payload` | JSON | NOT NULL | 事件负载 |
| `lineage_hints` | JSON | NULLABLE | D1 lineage 侧车（与 `Event.lineage_hints` 对齐）|
| `created_at` | DateTime | NOT NULL, INDEX, DEFAULT now() | 创建时间 |
| `processed_at` | DateTime | NULLABLE | 发布完成时间 |
| `retry_count` | Integer | NOT NULL, DEFAULT 0 | 重试计数 |
| `status` | String(32) | NOT NULL, INDEX, DEFAULT 'pending' | pending / published / dead |

### 索引（5 个）

| 索引名 | 列 | 用途 |
|---|---|---|
| `ix_outbox_event_tenant_id` | `tenant_id` | 租户维度查询 |
| `ix_outbox_event_event_type` | `event_type` | 事件类型过滤 |
| `ix_outbox_event_created_at` | `created_at` | 时间范围扫描（relay 轮询）|
| `ix_outbox_event_status` | `status` | 状态过滤（pending → published）|
| `ix_outbox_event_tenant_status` | `tenant_id, status`（复合）| relay 核心查询 `WHERE tenant_id=? AND status='pending'` |

### ADR-0013 对齐

| ADR-0013 字段 | 迁移字段 | 说明 |
|---|---|---|
| `event_id` | `id` | 重命名（与 `Event.id` 对齐）|
| `tenant_id` | `tenant_id` | 不变 |
| `aggregate_id` | `aggregate_id` | 不变 |
| `event_type` | `event_type` | 不变 |
| `payload` | `payload` | 不变（JSONB → JSON 跨方言兼容）|
| `occurred_at` | `created_at` | 重命名（语义更清晰）|
| `published_at` | `processed_at` | 重命名（含 retry 完成场景）|
| `attempts` | `retry_count` | 重命名 |
| `trace_id` | — | 已由 OTel collector 注入 trace（§13 第 9 条），不在 outbox 表冗余存储 |
| — | `aggregate_type` | 新增（ADR-0013 原始 schema 未含，便于按聚合根类型分片查询）|
| — | `lineage_hints` | 新增（D1 lineage 侧车）|
| — | `status` | 新增（relay 生命周期管理：pending → published → dead）|

---

## 4. G7 — SealedSecrets 备份 runbook 内容覆盖

| 章节 | 内容 | 状态 |
|---|---|---|
| §1 目的 | 主私钥丢失 = 全部 Secret 不可恢复；RTO ≤ 4h | ✅ |
| §2 前置 | Kubeseal ≥ 0.27 / controller ≥ 2.16 / kubectl 集群访问 / 异地存储 | ✅ |
| §3 备份流程 | kubectl 提取 `sealed-secrets-key` → Vault Transit / AWS KMS / GCP KMS 加密（推荐 Vault）→ 清理临时文件 → 更新清单 | ✅ |
| §4 恢复流程 | 从 Vault 解密 → apply 到 K8s → 重启 controller → 验证 SealedSecret 可解密 | ✅ |
| §5 演练计划 | 每季度 1 次；staging 验证；RTO ≤ 4h 目标 | ✅ |
| §6 责任人 | Platform Owner / SRE on-call / Security Officer | ✅ |
| §7 关联 | ADR-0010 §4.3 / §13 第 12 条 / 备份清单模板 | ✅ |
| 备份清单模板 | 备份记录 + Vault KV 路径 + 演练日志 + 密钥轮换记录 + 审计追踪 | ✅ |

---

## 5. 测试结果

### G3 新增测试（6 个）

```
mate-platform-backend/packages/mate-tech-db/tests/test_outbox_migration.py
  test_outbox_event_table_exists_after_upgrade          PASSED
  test_outbox_event_tenant_id_not_null                  PASSED
  test_outbox_event_status_default_pending              PASSED
  test_outbox_event_indexes_present                     PASSED
  test_outbox_event_lineage_hints_nullable              PASSED
  test_outbox_event_downgrade_drops_table               PASSED

============================== 6 passed ==============================
```

### mate-tech-db 全量回归

```text
$ python -m pytest mate-platform-backend/packages/mate-tech-db/tests -q --tb=short
.......................                                                  [100%]
23 passed, 7 warnings in 71.76s
```

- 17 既有 + 6 新增 = 23 / 23 passed
- 7 warnings 为 Alembic `path_separator` deprecation（不影响功能）

### infra/tests 回归

```text
$ python -m pytest infra/tests -q --tb=short
........................................................................ [ 34%]
........................................................................ [ 68%]
..................................................................       [100%]
210 passed in 1.91s
```

- 210 / 210 passed（无回归）

---

## 6. 13 硬规则映射

| # | 硬规则 | G3 / G7 关联 | 证据 |
|---|---|---|---|
| 3 | 没有 tenant 上下文，不访问 repository | G3: `outbox_event.tenant_id NOT NULL + INDEX` | 迁移 0007 + `test_outbox_event_tenant_id_not_null` |
| 8 | 没有 K8s readiness + 回滚 | G3: Alembic downgrade 可回滚 outbox_event 表 | `test_outbox_event_downgrade_drops_table` |
| 9 | 没有审计、指标、trace | G3: outbox_event 表是事件审计的基础存储；`lineage_hints` 列与 D1 lineage 对齐 | ADR-0013 §2.1 + 迁移 0007 `lineage_hints` JSON NULLABLE |
| 10 | 所有状态以验收证据为准 | G3 + G7 验收文档 = 本文件 | — |
| 12 | Secret 不进 git | G7: SealedSecrets 主私钥异地备份 runbook + 恢复 + 演练 | `sealed-secret-backup.md` + `sealed-secret-backup-inventory.md` |

---

## 7. 其他 G 项状态

| # | 项 | 状态 | 备注 |
|---|---|---|---|
| G1 | kafka sub-chart 落地 | In Progress | 不在本批次范围 |
| **G3** | **Outbox DDL 迁移** | **✅ Accepted** | 本批次 |
| G4 | 真实 K8s 集成 e2e | Not Started | 不在本批次范围 |
| G5 | per-service `security:` 段补齐 | In Progress | 不在本批次范围 |
| G6 | 已有表 `tenant_id` 回填 + RLS | Not Started | 不在本批次范围 |
| **G7** | **SealedSecrets 主私钥备份 runbook** | **✅ Accepted** | 本批次 |
| G8 | 清理 main 上旧 `infra/` | Not Started | 不在本批次范围 |

---

## 8. 结论

- **G3 Accepted**: `outbox_event` 表 Alembic 迁移 0007 已落地（11 字段 + 5 索引，
  `tenant_id` NOT NULL），6 个测试全绿，mate-tech-db 23/23 回归通过，
  infra/tests 210/210 回归通过。
- **G7 Accepted**: SealedSecrets 主私钥异地备份 runbook 覆盖备份 / 恢复 /
  演练 / 责任人全流程，备份清单模板就绪，关联 ADR-0010 §4.3 与 §13 第 12 条。
- **G2 / G4 / G5 / G6 / G8** 仍为 In Progress / Not Started，不在本批次范围。
