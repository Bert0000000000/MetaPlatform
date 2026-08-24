# ADR-0060：完全抛弃 v3.0 数据迁移策略

> **状态**：Proposed（待评审）  
> **日期**：2026-08-19  
> **作者**：Claude (MiniMax-M3) + 用户协作  
> **关联 ADR**：ADR-0049（v6.0 架构总方案）、ADR-0052（v6.0 后端 TypeScript 化）  
> **关联 Batch**：MP-V6-MIGRATION-01

---

## 1. 背景

MetaPlatform v3.0 GA 已 Accepted，13 硬规则保障生产可用。但 v3.0 的实现模式（FastAPI + Keycloak + Kafka + Flowable + llmgw + LangChain + LightRAG + 自研 SuperAI 等）在 v6.0 已被新架构（Supabase 全栈 + dsh + Temporal + Edge Functions + TypeScript 全栈）完全替代。

关键问题：**v3.0 的代码和数据如何处理？**

---

## 2. 决策

**完全抛弃 v3.0 代码 + 仅 ETL 关键数据 + v6.0 从零开发。**

### 决策要点

| 类别 | 处理方式 |
|---|---|
| **v3.0 代码** | ❌ 完全抛弃，不迁移、不双写、不共存 |
| **v3.0 数据** | ✅ 仅 ETL 关键数据（用户 / 租户 / 17 域业务 / 审计日志） |
| **v3.0 服务** | 期间继续运行，Sprint 3 末切流量后停服 |
| **v6.0 开发** | 从零开发（TypeScript + Supabase + dsh + Temporal） |

---

## 3. 理由

### 3.1 为什么完全抛弃

| 理由 | 说明 |
|---|---|
| **v3.0 实现已被替代** | FastAPI / Keycloak / Kafka / Flowable 等 11 个组件 v6.0 全部替换 |
| **代码兼容成本高** | 双写 / 共存 / 渐进迁移需要 6-12 个月 |
| **风险更低** | 双写不一致 / 漏写 / 性能影响 → 完全抛弃无此风险 |
| **代码更干净** | v6.0 无历史包袱，从零设计 |
| **更激进但更快** | 完全抛弃比迁移更快（48 周 vs 50 周）|
| **SaaS / 新平台常规** | 完全重写是 SaaS 平台升级的常见做法 |

### 3.2 为什么 ETL 数据（不抛弃数据）

| 理由 | 说明 |
|---|---|
| **用户不能丢** | 用户已注册，丢账号 = 客户流失 |
| **业务数据不能丢** | Order / Contract 等有法律 / 商业价值 |
| **审计合规** | 历史审计日志需要保留 N 年（合规要求）|

### 3.3为什么不迁移代码

| 原因 | 说明 |
|---|---|
| **Schema 不一致** | v3.0 schema vs v6.0 schema 不兼容（RLS / 字段类型）|
| **业务规则重写** | 17 域规则可重新设计，更符合 v6.0 Ontology 设计 |
| **Workflow 重构** | v6.0 用 Temporal，原 Flowable 不兼容 |
| **HITL 重构** | v6.0 HITL Hub 4 种类型，比 v3.0 更强大 |

---

## 4. 范围

### 4.1 完全抛弃（不迁移）

| 组件 | 原因 |
|---|---|
| mate-platform FastAPI Python 后端 | v6.0 用 Edge Functions |
| Keycloak | v6.0 用 Supabase Auth |
| Kafka + Outbox | v6.0 用 trigger + Webhook |
| MinIO | v6.0 用 Supabase Storage |
| Redis | v6.0 用 Supabase 内置缓存 |
| Flowable Java | v6.0 用 Temporal + 第三方 SaaS |
| MP-SANDBOX-01 Firecracker | v6.0 不用 |
| 自建 llmgw | v6.0 用 dsh llm-pi-ai |
| LangChain / LangGraph | v6.0 用 dsh 60% 复用 |
| LightRAG | v6.0 用 GraphRAG |
| 自建 SuperAI | v6.0 用 dsh |
| 所有 Python 业务代码 | v6.0 用 TypeScript 重写 |

### 4.2 保留（基础设施）

| 组件 | 原因 |
|---|---|
| K8s 集群 | 升级到 v6.0 多套环境（保留旧集群参考）|
| Helm charts | 重写为 v6.0 umbrella chart |
| ArgoCD | 重写 ApplicationSet |
| cert-manager | 升级（已有）|
| Vault / ExternalSecret | 升级（已有）|
| NetworkPolicy | 重写为 v6.0 default-deny |
| GitHub Actions workflow | 重写为 v6.0 workflow（4 个 workflow 文件）|

### 4.3 仅导出数据（不迁移逻辑）

| 数据类型 | 导出方式 | 导入到 |
|---|---|---|
| **用户**（含密码 hash） | SQL dump | Supabase Auth users |
| **租户** | SQL dump | Supabase tenants 表 |
| **17 域业务数据** | SQL dump | Supabase PG（schema 映射 + RLS 重写）|
| **审计日志** | SQL dump | 冷存储归档（不入热库）|

### 4.4 重建（v6.0 原生）

| 内容 | 重建方式 |
|---|---|
| Ontology 12 Kernel | v6.0 重新建模 |
| 17 域 ObjectType | v6.0 重新设计（更优）|
| Workflow 定义 | v6.0 重新配置（Temporal + 业务配置）|
| 数字员工 preset ×7 | v6.0 重新设计 |
| dsh session | v6.0 全新 |
| HITL Hub | v6.0 全新（4 种 HITL）|

---

## 5. 实施计划

### 5.1 时间线

```
Q4-2026 (Sprint 0)
  ├─ v3.0 服务停止新功能开发（仅维护 + bugfix）
  ├─ v3.0 服务继续运行（业务不停）
  └─ v6.0 团队独立开发（不依赖 v3.0）

Q1-2027 (Sprint 1)
  ├─ v6.0 核心引擎就绪
  └─ v6.0 内部 dogfooding

Q1-Q2-2027 (Sprint 2)
  ├─ v6.0 17 域 + AI 就绪
  └─ 用 v6.0 处理新业务（增量数据进 v6.0）

Q2-Q3-2027 (Sprint 3)
  ├─ 一次性 ETL：v3.0 用户 / 租户 / 17 域 → v6.0
  ├─ 按租户切流量（v3.0 → v6.0）
  └─ v3.0 标记 deprecated（仅应急）

Q4-2027
  └─ v3.0 完全退役 + v6.0 GA
```

### 5.2 4 个关键里程碑

| 里程碑 | 时间 | 标志 |
|---|---|---|
| **M1 v6.0 基础设施就绪** | Q4-2026 | Sprint 0 完成 |
| **M2 MVP 可用** | Q1-2027 | Sprint 1 完成（业务用户能跟 7 个数字员工对话）|
| **M3 商业可用** | Q2-2027 | Sprint 2 完成（17 域 + AI + 阈值实时触发）|
| **M4 v6.0 GA** | Q3-2027 | Sprint 3 完成（v3.0 退役 + v6.0 完全接管） |

---

## 6. ETL 设计（MP-V6-MIGRATION-01）

### 6.1 工作量

2-3 周（与 Sprint 3 重叠）

### 6.2 范围

| 阶段 | 内容 |
|---|---|
| **导出（v3.0）** | users / tenants / 17 域业务 / audit_logs（仅 dump）|
| **导入（v6.0）** | Supabase Auth users + tenants 表 + 17 域业务（schema映射 + RLS）+ 冷存储归档 |
| **不迁移** | Ontology / Workflow / preset / dsh session（v6.0 全新）|

### 6.3 关键脚本

```
scripts/etl/
├── export_v3_users.sql           # 导出用户
├── export_v3_tenants.sql         # 导出租户
├── export_v3_business.sql        # 导出 17 域
├── export_v3_audit_logs.sql     # 导出审计日志
├── schema_mapping.yaml           # v3.0 → v6.0 字段映射
├── import_v6_users.py            # 导入 Supabase Auth
├── import_v6_business.py         # 导入 Supabase PG
├── import_v6_audit_cold.py      # 导入冷存储
└── verify_etl.sql                # 数据一致性校验
```

### 6.4 Schema 映射示例（Order 表）

| v3.0 字段 | v6.0 字段 | 转换 |
|---|---|---|
| `order_id BIGINT` | `id UUID` | 重新生成 UUID |
| `tenant_id INT` | `tenant_id UUID` | 新映射 UUID |
| `customer_id BIGINT` | `customer_id UUID` | 重新映射 |
| `amount DECIMAL(18,2)` | `amount NUMERIC(18,2)` | 类型转换 |
| `status VARCHAR(20)` | `status TEXT` | 值映射（业务状态机保持）|
| `created_by INT` | `created_by UUID` | 新映射 |
| `created_at DATETIME` | `created_at TIMESTAMPTZ` | 类型转换 |
| - | `tenant_id`（强制）| 新增（必须）|
| - | `updated_at TIMESTAMPTZ` | 新增 |
| - | `idempotency_key TEXT` | 新增（写幂等）|
| - | RLS policy | 新增 |

---

## 7. 切流量策略

### 7.1 按租户分批切

```
Week 1: dev 租户（内部 dogfooding）
Week 2: staging 租户（10% 客户）
Week 3: canary 租户（1% 客户）
Week 4-6: 灰度 50% 客户（按字母 / 行业）
Week 7: 100%（全量）
```

### 7.2 切流量步骤

```
1. 选定租户 → 在 v3.0 / v6.0 同时打标
2. v3.0 服务加 redirect header：X-MP-V6-Pilot: true
3. 租户请求带此 header → 路由到 v6.0
4. 验证 v6.0 正常工作 24h
5. 租户取消 v3.0 标记 → 全量切 v6.0
6. v3.0 服务降低流量（仅应急）
```

---

## 8. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| **ETL 失败** | 🟠 中 | 多次演练（dev / staging）+ 回滚方案 |
| **切流量期间业务中断** | 🟠 中 | 按租户分批切 + 应急预案 + 24h 监控 |
| **用户密码迁移失败** | 🟡 低 | 强制重置或兼容 hash |
| **Schema 不一致** | 🟠 中 | 提前做映射 + 测试 + 数据校验 |
| **审计日志丢失** | 🟡 低 | 归档到冷存储，保留 N 年 |
| **v3.0 漏洞** | 🟠 中 | v3.0 期间只修 P0 漏洞，不做新功能 |

---

## 9. 不做（明确反对）

| 不做 | 原因 |
|---|---|
| ❌ v6.0 兼容 v3.0 schema | 包袱太大 |
| ❌ 双写 | 风险高、不一致 |
| ❌ 渐进式共存 | 周期长、复杂度高 |
| ❌ 重写 Python 业务代码 | Python 不在 v6.0 技术栈 |
| ❌ 在 v6.0 引入 Keycloak | v6.0 用 Supabase Auth |
| ❌ 在 v6.0 引入 Kafka | v6.0 用 trigger + Webhook |

---

## 10. ADR 替代方案（已否决）

### 方案 A：渐进式共存
- ❌ 工作量大（6-12 个月）
- ❌ 风险高（双写不一致）
- ❌ 代码兼容（schema 冲突）

### 方案 B：数据迁移 + 兼容 schema
- ❌ v6.0 schema 受 v3.0 限制
- ❌ 重写困难（业务规则重做需修改 schema）

### 方案 C：完全抛弃（**已选**）
- ✅ 从零开发
- ✅ 代码干净
- ✅ 48 周完成
- ✅ 风险低

---

## 11. 关联文档

- 技术架构 spec：`docs/active/specs/2026-08-19-mp-v6-architecture.md`
- 应用架构 spec：`docs/active/specs/2026-08-19-mp-v6-application-architecture.md`
- 模块规划 spec：`docs/active/specs/2026-08-19-mp-v6-module-planning.md`
- MP-V6-MIGRATION-01 Batch：`docs/active/batch/MP-V6-MIGRATION-01.md`

---

## 12. 评审签字

| 角色 | 姓名 | 签字 | 日期 |
|---|---|---|---|
| 架构师 | | | |
| 后端 Lead | | | |
| SRE Lead | | | |
| PM | | | |

---

*ADR-0060：完全抛弃 v3.0，仅 ETL 关键数据，v6.0 从零开发。*