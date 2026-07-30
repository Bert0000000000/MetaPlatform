# BUSINESS-SLICES 17 域接入进度

> 版本：v1.0 · 2026-07-30
> 关联：ADR-0014 17 域集成模式
> 配套：docs/active/specs/2026-07-30-per-app-integration-checklist.md

---

## 1. 进度总览

| P | 域 | 状态 | 5 步完成 | 接入 commit |
|---|---|---|---|---|
| **P0** | `kb` (mate-app-kb) | ✅ Done | 5 / 5 | 7fa52dc8 (TECH-SERVICES) |
| **P0** | `iam` (mate-tech-iam) | 🟡 Deprecated | n/a | 标记 deprecated,生产 profile 拒绝加载 |
| **P1** | `msg` (mate-tech-msg) | ✅ Done | 5 / 5 | 5f53524a (本批) |
| **P1** | `obs` (mate-tech-obs) | ✅ Done | 5 / 5 | 5f53524a (本批) |
| **P1** | `agent` (mate-tech-agent) | ⏳ Queued | 0 / 5 | — |
| **P1** | `rag` (mate-tech-rag) | ⏳ Queued | 0 / 5 | — |
| **P1** | `llmgw` (mate-tech-llmgw) | ⏳ Queued | 0 / 5 | — |
| P2 | `apphub` | ⏳ Queued | 0 / 5 | — |
| P2 | `arch` | ⏳ Queued | 0 / 5 | — |
| P2 | `copilot` | ⏳ Queued | 0 / 5 | — |
| P2 | `dashboard` | ⏳ Queued | 0 / 5 | — |
| P2 | `dw` | ⏳ Queued | 0 / 5 | — |
| P2 | `data` | ⏳ Queued | 0 / 5 | — |
| P2 | `a2a` | ⏳ Queued | 0 / 5 | — |
| P2 | `mcp` (mate-tech-mcp) | ⏳ Queued | 0 / 5 | — |
| P2 | `ont` (mate-tech-ont) | ⏳ Queued | 0 / 5 | — |
| P2 | `wfe` | ⏳ Queued | 0 / 5 | — |

**已接入**: 3 / 17 (mate-app-kb, msg, obs)

---

## 2. 已接入域详情

### 2.1 `mate-app-kb` (P0 canonical, commit 7fa52dc8)

- ✅ 步骤 1：`install_auth(app)`
- ✅ 步骤 2：每个 handler 第一行 `require_tenant(ctx)`
- ✅ 步骤 3：outbox hook 接入
- ✅ 步骤 4：BearerAuth + OutgoingAuthMiddleware
- ✅ 步骤 5：12 tests（含 3 跨租户 negative）

### 2.2 `mate-tech-msg` (P1, commit 5f53524a)

- ✅ 步骤 1：`install_auth(app)` 在 main.py 顶部
- ✅ 步骤 2：`/api/v1/msg/publish` 与 `/api/v1/msg/topics` 第一行 `require_tenant(ctx)`
- ⏸️ 步骤 3：outbox 暂未集成（msg 自身是事件总线,业务事务 + outbox 在 PLATFORM-EVENT-01 阶段)
- ⏸️ 步骤 4：kafka_client.py 内部用 `aiokafka`,由 IdempotentConsumer 模式处理;不外发 HTTP
- ✅ 步骤 5：7 tests（含 3 跨租户 negative）

### 2.3 `mate-tech-obs` (P1, commit 5f53524a)

- ✅ 步骤 1：`install_auth(app)`
- ✅ 步骤 2：`/api/v1/obs/health` 与 `/api/v1/obs/instrument` 第一行 `require_tenant(ctx)`
- n/a 步骤 3：obs 是只读聚合,不写业务事务
- n/a 步骤 4：obs 不外发 HTTP（只接收 prometheus scrape 与 OTel push）
- ✅ 步骤 5：7 tests（含 3 跨租户 negative）

注：`/healthz` 与 `/metrics` 保持匿名（k8s probe + prometheus scrape;在
`mate_platform.auth.middleware.ANONYMOUS_PATHS` 白名单内）。

---

## 3. 后续接入顺序

按 ADR-0014 §2.5 + 实际工作量排序：

| 顺序 | 域 | 原因 |
|---|---|---|
| 4 | `agent` (P1) | 22 src files,核心 AI 编排,优先接入 |
| 5 | `rag` (P1) | 29 src files,数据流最重,KB 已用 |
| 6 | `llmgw` (P1) | 37 src files,LLM 路由 |
| 7 | `mcp` (P2 → 调整到 P1) | 20 src files,工具较少,适合快速接入 |
| 8 | `apphub` (P2) | 业务应用中心 |
| 9 | `arch` (P2) | 架构中心 |
| 10 | `copilot` (P2) | AI 助手 |
| 11 | `dashboard` (P2) | 工作台 |
| 12 | `dw` (P2) | 数字员工 |
| 13 | `data` (P2) | 数据应用 |
| 14 | `a2a` (P2) | 协议 |
| 15 | `ont` (P2) | 本体引擎 |
| 16 | `wfe` (P2) | 工作流引擎 |

每域接入独立 PR + commit,沿用本次 `5f53524a` 的 5 步模式。