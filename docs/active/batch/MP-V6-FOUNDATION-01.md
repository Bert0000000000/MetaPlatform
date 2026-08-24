# MP-V6-FOUNDATION-01 — Supabase + K8s 基础设施

> **Batch 状态**：Pending Acceptance
> **优先级**：🔴 P0（必做，其他 Batch 全部依赖）
> **工作量**：4 周
> **团队**：SRE + AI 团队
> **依赖**：无（基础 Batch）

---

## 1. 目标

部署 Supabase 全栈 + K8s 基础设施，让后续所有 Batch 有可运行的环境。

## 2. 配套文档

- 技术架构 spec：[`docs/active/specs/2026-08-19-mp-v6-architecture.md`](../../specs/2026-08-19-mp-v6-architecture.md)
- 应用架构 spec：[`docs/active/specs/2026-08-19-mp-v6-application-architecture.md`](../../specs/2026-08-19-mp-v6-application-architecture.md)
- 模块规划 spec：[`docs/active/specs/2026-08-19-mp-v6-module-planning.md`](../../specs/2026-08-19-mp-v6-module-planning.md)

---

## 3. 关键交付

### 3.1 Supabase 8 个能力部署

| 能力 | 验证方式 |
|---|---|
| Postgres 14+ | `psql -c "SELECT version()"` 成功 |
| pgvector | `CREATE EXTENSION vector` 成功 |
| Auth (GoTrue) | `/auth/v1/health` 返回 200 |
| Realtime | WebSocket 连接测试 |
| Storage | S3 API endpoint 测试 |
| Edge Functions (Deno) | 部署 hello world function |
| PostgREST | `/rest/v1/` 返回 OpenAPI |
| Studio | Web UI 登录成功 |

### 3.2 K8s 基础设施

|组件 | 验证 |
|---|---|
| K8s 集群（生产）| kubectl get nodes 成功 |
| cert-manager | Certificate issued for `*.mp-platform.local` |
| ArgoCD | Application CRD 部署成功 |
| Helm chart | umbrella chart 安装成功 |

### 3.3 网络与命名空间

|Namespace | 用途 |
|---|---|
| mp-platform | 平台总命名空间（默认） |
| mp-frontend | 后续前端应用 |
| mp-runtime | 后续 dsh runtime |
| mp-business | 后续 Edge Functions |
| mp-ai | 后续 AI 服务 |
| mp-orchestration | 后续 Temporal |
| mp-integration | 后续集成 |
| mp-data | Supabase 全套 |
| mp-monitoring | OTel + Grafana |
| mp-infra | cert-manager / argocd / vault |

### 3.4 RLS 基线

所有 Supabase 表默认开启 RLS，禁止直接跨租户访问。

---

## 4. 详细任务清单

### 第 1 周：环境准备

- [ ] 创建 K8s 集群（生产 / staging / dev 三套）
- [ ] 部署 cert-manager（Let's Encrypt）
- [ ] 部署 ArgoCD
- [ ] 部署 Vault（或 ExternalSecrets）
- [ ] 创建 10 个 namespace

### 第 2 周：Supabase 自托管

- [ ] 用 Supabase 官方 Helm chart 部署
- [ ] 配置 PG（含 pgvector 扩展）
- [ ] 配置 Auth (GoTrue)
- [ ] 配置 Realtime
- [ ] 配置 Storage
- [ ] 配置 Edge Functions runtime
- [ ] 配置 PostgREST
- [ ] 配置 Studio
- [ ] 验证8 个能力全部可用

### 第 3 周：RLS + 安全 + 备份

- [ ] 创建 baseline RLS policy（所有表 tenant 隔离）
- [ ] 创建 baseline audit_log 表
- [ ] 配置 PG 自动备份（WAL 归档）
- [ ] 配置 K8s NetworkPolicy（默认 deny + 白名单）
- [ ] 配置 ExternalSecret（API Key 等不进 git）
- [ ] 验证 dsh 服务可以从 K8s 内访问 Supabase

### 第 4 周：集成验证 + 文档

- [ ] 端到端测试：创建租户 → 登录 → 写入数据 → RLS 隔离生效
- [ ] 写 deployment runbook
- [ ] 写 BACKUP_RPO_RTO 文档
- [ ] evidence/MP-V6-FOUNDATION-01-ACCEPTANCE.md 落地
- [ ] 通知下游 Batch 可启动

---

## 5. 关键依赖

|依赖 | 来源 |
|---|---|
| Supabase Helm chart | 官方：[`supabase/supabase`](https://github.com/supabase/supabase/tree/master/docker) |
| cert-manager | 官方 JetStack |
| ArgoCD | 官方 |
| Vault | 官方 |

## 6. 验收标准（AC）

- [ ] K8s 集群 3 套（生产 / staging / dev）
- [ ] Supabase 8 个能力全部部署 + 验证通过
- [ ] RLS baseline 生效（跨租户访问被拒）
- [ ] NetworkPolicy default-deny 生效
- [ ] PG 自动备份运行 + RPO < 5 分钟
- [ ] 所有 Secret 走 ExternalSecret
- [ ] dsh 服务可访问 Supabase（端口 + DNS + Auth 全部验证）
- [ ] evidence/MP-V6-FOUNDATION-01-ACCEPTANCE.md 完成
- [ ] 通知下游 Batch（MP-V6-TEMPORAL-01 / MP-V6-DSH-DOCKER-01）可启动

## 7. 风险与缓解

|风险 | 缓解 |
|---|---|
| Supabase Helm chart 不稳定 | 用官方稳定版 + pin 版本 |
| RLS 写写错导致数据泄露 | 严格测试 + Studio RLS Editor 审核 |
| PG 备份失效 | 每月演练恢复 |
| dsh 服务连不上 Supabase | K8s NetworkPolicy + 测试提前验证 |

---

## 8. 下游依赖

本 Batch 完成后，以下 Batch 可启动：
- MP-V6-TEMPORAL-01
- MP-V6-DSH-DOCKER-01
- MP-V6-DSH-K8S-01
- MP-V6-OBSERVABILITY-01
- MP-V6-AUTH-01