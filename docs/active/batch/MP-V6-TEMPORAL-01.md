# MP-V6-TEMPORAL-01 — Temporal Cluster 部署

> **Batch 状态**：Pending Acceptance
> **优先级**：🔴 P0（必做）
> **工作量**：3 周
> **团队**：SRE + 后端
> **前置依赖**：MP-V6-FOUNDATION-01

---

## 1. 目标

部署 Temporal Cluster，复用 Supabase Postgres 作为持久化存储，让业务 Workflow 编排就绪。

## 2. 配套文档

- 技术架构 spec：[`docs/active/specs/2026-08-19-mp-v6-architecture.md`](../../specs/2026-08-19-mp-v6-architecture.md) §7 Temporal 长任务
- 应用架构 spec：[`docs/active/specs/2026-08-19-mp-v6-application-architecture.md`](../../specs/2026-08-19-mp-v6-application-architecture.md)

---

## 3. 关键交付

### 3.1 Temporal Cluster

|组件 | 验证 |
|---|---|
| Temporal Server | gRPC `:7233` 可访问 |
| Temporal Web UI | `:8233` 可访问 |
| Persistence | 复用 Supabase Postgres（schema `temporal`） |
| Visibility | 复用 Supabase Postgres |
| Namespace | `mp-platform`（默认） |

### 3.2 PostgreSQL 准备

- [ ] 在 Supabase PG 创建 `temporal` schema
- [ ] 运行 Temporal schema migration（`temporal sql --db-type postgres`）
- [ ] 创建专用 DB user `temporal`（最小权限）
- [ ] 配置 RLS 例外（Temporal 系统账号绕过 RLS）

### 3.3 worker Namespace 隔离

| Namespace | 用途 |
|---|---|
| `mp-platform` | 默认命名空间 |
| `mp-staging` | staging 环境 |
| `dev` | 开发环境 |

### 3.4 集成验证

- [ ] Temporal UI 可访问
- [ ] 启动一个 hello world workflow（Node SDK）成功
- [ ] workflow 信号双向（signal + query）测试
- [ ] 1 周长任务测试（wait_condition 24h）

---

## 4. 详细任务清单

### 第 1 周：Postgres 准备 + Temporal 部署

- [ ] Supabase PG 创建 `temporal` schema + migration
- [ ] 部署 Temporal Server（Helm chart）
- [ ] 配置 DB connection（专用 user）
- [ ] 验证 Temporal gRPC `:7233` 可访问
- [ ] 验证 Temporal UI `:8233` 可访问

### 第 2 周：Worker SDK + 集成测试

- [ ] 创建 Temporal Worker（Node SDK）基础工程
- [ ] 部署到 K8s mp-orchestration namespace
- [ ] 测试 hello world workflow
- [ ] 测试 signal 双向通信
- [ ] 测试 Activity heartbeat

### 第 3 周：长任务 + 兜底

- [ ] 测试 24h 长任务（wait_condition）
- [ ] 测试 Activity retry + backoff
- [ ] 配置 Temporal metrics 上报 OTel
- [ ] 文档 + evidence/MP-V6-TEMPORAL-01-ACCEPTANCE.md
- [ ] 通知下游 Batch 可启动

---

## 5. 关键依赖

|依赖 | 来源 |
|---|---|
| Temporal Helm chart | [`temporalio/temporal`](https://github.com/temporalio/helm-charts) |
| Supabase PG | MP-V6-FOUNDATION-01 |

## 6. 验收标准（AC）

- [ ] Temporal Server 部署成功
- [ ] Temporal UI 可访问
- [ ] `temporal` schema migration 完成
- [ ] Temporal Worker（Node）部署到 K8s
- [ ] hello world workflow 跑通
- [ ] signal + query 双向通信正常
- [ ] 24h 长任务测试通过
- [ ] OTel metrics 上报配置
- [ ] evidence/MP-V6-TEMPORAL-01-ACCEPTANCE.md 完成
- [ ] 通知下游 Batch（MP-V6-TEMPORAL-TS-01 / MP-V6-HITL-HUB-01）可启动

## 7. 风险与缓解

|风险 | 缓解 |
|---|---|
| Temporal 与 PG 共用，资源争抢 | Temporal 用专用 schema + 专用 user |
| 长任务 history 膨胀 | enable `continue-as-new` 策略 |
| Temporal 版本升级 breaking | pin 版本 + staging 验证 |
| Worker 任务堆积 | K8s HPA + concurrency limit |

## 8. 下游依赖

本 Batch 完成后可启动：
- MP-V6-TEMPORAL-TS-01（Temporal worker Node SDK）
- MP-V6-HITL-HUB-01（HITL Hub）
- MP-V6-APPROVAL-01（审批 SaaS 适配）