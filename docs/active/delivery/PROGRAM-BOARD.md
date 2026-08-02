# Mate Platform 交付项目计划板（Program Board）

> 更新时间：2026-08-01（含 v3.1 增量 sub-batch + P3-W6/W7 wave + PR 治理状态；G3/G7 Accepted）
> 本表跟踪各交付批次在契约、代码、测试、运行时和验收证据上的当前状态。

## v3.0 GA 状态（9/9 核心 + D0-D8 全部 Accepted）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 |
|---|---|---:|---:|---:|---:|---|
| API-GOV-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ local/docs | `evidence/API-GOV-01-ACCEPTANCE.md` |
| ARCH-CORE-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/ARCH-CORE-01-ACCEPTANCE.md` |
| PLATFORM-K8S-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/PLATFORM-K8S-01-ACCEPTANCE.md` |
| SEC-IAM-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/SEC-IAM-01-ACCEPTANCE.md` |
| SEC-TENANT-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/SEC-TENANT-01-ACCEPTANCE.md` |
| PLATFORM-EVENT-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/PLATFORM-EVENT-01-ACCEPTANCE.md` |
| TECH-SERVICES | **Accepted** | ✓ | ✓ | 1/17 ✓ | ⏳ 16/17 P0/P1/P2 | `evidence/TECH-SERVICES-ACCEPTANCE.md` |
| GA-ACCEPTANCE | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/GA-ACCEPTANCE.md` |
| BUSINESS-SLICES | **Accepted (P1 W1)** | ✓ | ✓ | 2/17 ✓ | ⏳ 15/17 P2 | `evidence/BUSINESS-SLICES-ACCEPTANCE.md` |
| **DATA-D0-D8** | **D0-D8 Accepted** ✓ | ✓ | ✓ | 45/45 ✓ | ✓ | `evidence/DATA-D0-D8-D{0..8}-ACCEPTANCE.md` |

**说明**：TECH-SERVICES 与 BUSINESS-SLICES 是 v3.0 GA 收口的"模式就位 + 部分接入"状态，剩余域的接入属于 v3.1 sub-batch。

## v3.1 增量 sub-batch（进行中）

### In Progress — 业务域 P2 wave

| sub-batch | 域 | 接力分支 | 依赖 | 状态 |
|---|---|---|---|---|
| BUSINESS-SLICES P1 W2 | msg / obs（已含 W1 完整接入 + 5 步模式）| `codex/business-slices-w2` | TECH-SERVICES | ✅ Accepted |
| BUSINESS-SLICES P1 W3 | rag / mcp | `codex/p1-wave3` | TECH-SERVICES | ✅ Accepted |
| BUSINESS-SLICES P2 W1 | ont（带代码） | `codex/p2-wave` | P1 W3 | ✅ Accepted |
| **BUSINESS-SLICES P2 W2** | dashboard / apphub / arch / copilot（4 域，99 endpoints / 93 tests）| `codex/p2-wave-2` → PR #12 | P2 W1 | ✅ Accepted（2026-07-31，PR #12 合入 main，commit `833a809d`） |
| **BUSINESS-SLICES P2 W3** | dw / data / a2a / ont / wfe（5 域，需先建包代码） | 待开 | P2 W2 | 🔴 Not Started |

### In Progress — TECH-SERVICES 16 域接入

`TECH-SERVICES` 仅完成 `mate-app-kb` canonical reference；其余 16 域按 P0/P1/P2 优先级在后续 sub-batch 接力：

| 优先级 | 域 | 数量 |
|---|---|---:|
| P0 | agent / rag / llmgw / mcp | 4 |
| P1 | apphub / arch / copilot / dashboard | 4 |
| P2 | dw / data / a2a / ont / wfe / iam(deprecated) | 5+1 |

### Pending — GA 硬规则收口（pre-GA）

| # | 项 | 接力 | 来源 | 状态 |
|---|---|---|---|---|
| G1 | kafka sub-chart 落地（Bitnami/Confluent chart 选型） | PLATFORM-EVENT-01 | 多批次依赖 | **Accepted** ✅（KRaft 3-broker sub-chart + persistence 50Gi + tenantIsolation + networkpolicy + umbrella 集成 + 6 tests，证据 `G1-ACCEPTANCE.md`） |
| G2 | pre-commit raw-SQL + secret 扫描（gitleaks） | GA-ACCEPTANCE | §13 硬规则 6 + 12 | **Accepted** ✅（commit 待补，pre-commit 加固 + gitleaks 自定义规则 + 3 forbid 脚本 + 20 tests） |
| **G3** | **Outbox DDL 迁移（`CREATE TABLE outbox_event`）** | TECH-SERVICES 接力 | §13 硬规则 9 | **Accepted** ✅（commit `85f4df75`，Alembic 0007 + 6 tests） |
| G4 | 真实 K8s 集成 e2e（kind/staging 集群）| PLATFORM-K8S-01 | §13 硬规则 8 | **Accepted** ✅（证据 `G4-ACCEPTANCE.md`，kind CI workflow + 本地 smoke 脚本） |
| G5 | per-service `security:` 段补齐（17 域 oasdiff） | 每域接入时 | SEC-IAM-01 | **Accepted** ✅（commit 已合，17 域 security 三段式补齐，证据 `G5-ACCEPTANCE.md`） |
| G6 | 已有表 `tenant_id` 回填 + RLS 迁移 | PLATFORM-EVENT-01 | SEC-TENANT-01 | **Accepted** ✅（commit 已合，Alembic 0008，58 张表 + FORCE ROW LEVEL SECURITY，证据 `G6-ACCEPTANCE.md`） |
| **G7** | **SealedSecrets 主私钥异地备份 runbook** | SEC-IAM-01 | ADR-0010 §4.3 | **Accepted** ✅（commit `85f4df75`，2 runbook 文档） |
| G8 | 清理 main 上旧 `infra/`（otel/prometheus/grafana/keycloak/traefik/lightrag/promtail） | PLATFORM-K8S-01 | docker-compose 时代残留 | **Accepted** ✅（3 目录 + 2 空目录全部清理完成，docker-compose + PROFILES.md 引用清除，证据 `G8-FULL-ACCEPTANCE.md`） |

### P3-W6/W7 v3.1 增量 wave（2026-08-01）

| commit | 内容 | 测试 |
|---|---|---:|
| `bae2ec63` | **D1 lineage e2e** — 跨域 trace chain（msg→obs→dw）+ 租户隔离断言 + `LineageHints` 自动注入 | 6 e2e tests（infra）|
| `d799b956` | **P3-W6 并行 wave 收口** — business + features + engines + G8 旧 infra 清理 | 1292 tests（全后端回归）|

> ✅ **8/1 收口**:G8 docker-compose.yml 残留引用已清理（lightrag service block + promtail mount + otel mount），grep 验证 `infra/otel` / `infra/lightrag` / `infra/promtail` 0 匹配，G8 状态升级为 **Accepted**。证据 `G8-ACCEPTANCE-FINAL.md`。
| `85f4df75` | **G3 Outbox DDL**（Alembic 0007，`outbox_event` 11 字段 + 5 索引）+ **G7 SealedSecrets 备份 runbook**（2 文档） | 6 tests（G3）+ 23 mate-tech-db 回归 |
| `04ce4780` | **DATA helm subcharts 真实化** — debezium / marquez / datahub / ge 4 个 sub-chart 从占位升级为真实 values | 46 tests（infra helm） |
| `4878eb82` | **copilot 补 3 endpoint + A2A 真实（TD-4）+ LLM 真实 provider（TD-6）** — OpenAI / Anthropic provider 落地；copilot 35/35 全完成 | 18 tests + 1 test 修复 |

**测试总数演进**：1292（P3-W6）→ 1298（D1 +6）→ 1304（G3 +6）→ 1350（DATA helm +46）→ 1370（copilot/a2a/llmgw +20）

**验收证据**：`evidence/P3-W6-W7-ACCEPTANCE.md`（1500 passed / 0 failed = 1222 后端 + 278 infra）

### APPHUB-RUNTIME-01 收口（2026-08-02）

| sub-batch | 内容 | 状态 | 日期 | 备注 |
|---|---|---|---|---|
| K2 | APPHUB-RUNTIME-01 收口 | **Accepted** ✅ | 2026-08-02 | 治理收口 5 件 + 阶段 D 收尾 |

## 数据平台（DATA-D0-D8）—— v3.0 GA 硬前置已闭环

DATA-D0-D8 全部 8 阶段 Accepted（共 45/45 tests pass）。后续 sub-batch 在独立批次接力，详见 `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` 附录 A。

## 状态说明

- **Not Started**：批次尚未启动，尚未产出任何交付物。
- **In Progress**：已启动并在契约、代码或测试任一维度上推进，但尚未闭环验收。
- **Blocked**：存在阻塞依赖或外部决策，需协调后才能恢复推进。
- **Accepted**：交付完成、证据闭环、CI 全绿、Owner 已签字。

## PR 治理状态

### 已合并到 main

| PR | 来源 | Commit | 备注 |
|---|---|---|---|
| PR-R1 | `refactor/monorepo-shrink-phase-2` | `a00351c3` | CLAUDE.md v3.0 GA + refactor 视角合一（110 行）|
| PR #12 | `codex/p2-wave-2` | `833a809d` | BUSINESS-SLICES P2 W2：dashboard / apphub / arch / copilot 4 域 · 99 endpoints · 93 tests（2026-07-31）|

### 评估后归档（不合并 main）

| PR | 来源 | 独有 commits | archive tag | 不合并原因 |
|---|---|---:|---|---|
| PR-S1 | `sync/all-code-20260725` | 5 | `archive/sync-all-code-20260725-2026-07-25` | 与 v3.0 路线对立（7781faf6 unify to Java stack）；FlowGram admin 集成 main 已实现；R5 Java entity 修复与 main Python 后端无关 |

### 已归档 + 删除的分支（历史快照保留为 archive tag）

| 原分支 | archive tag | commit 保留 |
|---|---|---|
| `feat/platform-menu-unification` | `archive/feat-platform-menu-unification-2026-07-29` | `12842ea0` |
| `codex/deerflow-production-integration` | `archive/codex-deerflow-production-integration-2026-07-29` | `d758be1c` |
| `codex/ontology-native-deerflow-delivery` | `archive/codex-ontology-native-deerflow-delivery-2026-07-29` | `5ecd239d` |
| `pre-restructure-2026-07-29` | `archive/pre-restructure-2026-07-29` | `09ad4eb3` |
| `refactor/monorepo-shrink-phase-2` | `archive/refactor-monorepo-shrink-phase-2-2026-07-30` | `2832d777`（已合并 main via `a00351c3`）|

### 保留的主线分支（17 个，已合并 main，作为里程碑）

`codex/arch-core-01` / `codex/platform-k8s-01` / `codex/sec-iam-01` / `codex/sec-tenant-01` /
`codex/platform-event-01` / `codex/tech-services` / `codex/ga-acceptance` /
`codex/business-slices` / `codex/business-slices-w2` / `codex/p1-wave3` / `codex/p2-wave` /
`codex/data-d0-d8` / `codex/data-d0-d8-d0` / `codex/data-d0-d8-d1` / `codex/data-d0-d8-d2-d3` /
`codex/data-d0-d8-d4-d5` / `codex/data-d0-d8-d6-d7-d8`

## 已完成批次时间线

| 批次 | 接受日期 | Commit | 证据 |
|---|---|---|---|
| API-GOV-01 | 2026-07-30 | `1fa521fd` | `evidence/API-GOV-01-ACCEPTANCE.md` |
| ARCH-CORE-01 | 2026-07-30 | `eeaab5c5` | `evidence/ARCH-CORE-01-ACCEPTANCE.md` |
| PLATFORM-K8S-01 | 2026-07-30 | `4d0b73d6` | `evidence/PLATFORM-K8S-01-ACCEPTANCE.md` |
| SEC-IAM-01 | 2026-07-30 | `4d3d894e` | `evidence/SEC-IAM-01-ACCEPTANCE.md` |
| SEC-TENANT-01 | 2026-07-30 | `026ce4a8` | `evidence/SEC-TENANT-01-ACCEPTANCE.md` |
| PLATFORM-EVENT-01 | 2026-07-30 | `95b35e43` | `evidence/PLATFORM-EVENT-01-ACCEPTANCE.md` |
| TECH-SERVICES | 2026-07-30 | `7fa52dc8` | `evidence/TECH-SERVICES-ACCEPTANCE.md` |
| GA-ACCEPTANCE | 2026-07-30 | `87f589be` | `evidence/GA-ACCEPTANCE.md` |
| BUSINESS-SLICES P1 W1 | 2026-07-30 | `21a8acc7` | `evidence/BUSINESS-SLICES-ACCEPTANCE.md` |
| BUSINESS-SLICES P1 W2 | 2026-07-30 | `d4dea556` | 同上（v1.1 滚动状态） |
| BUSINESS-SLICES P1 W3 | 2026-07-30 | `41bef84d` | 同上 |
| BUSINESS-SLICES P2 W1 | 2026-07-30 | `d452e1ab` | 同上 |
| BUSINESS-SLICES P2 W2 | 2026-07-31 | `833a809d` | `evidence/P2-W2-ACCEPTANCE.md`（dashboard / apphub / arch / copilot 4 域 · 99 endpoints · 93 tests）|
| DATA-D0-D8 D0 | 2026-07-30 | `5b925bfe` | `evidence/DATA-D0-D8-D0-ACCEPTANCE.md` |
| DATA-D0-D8 D1 | 2026-07-30 | `14a7a314` | `evidence/DATA-D0-D8-D1-ACCEPTANCE.md` |
| DATA-D0-D8 D2+D3 | 2026-07-30 | `820838e2` | `evidence/DATA-D0-D8-D2-D3-ACCEPTANCE.md` |
| DATA-D2 v2 扩展 | 2026-08-01 | （本批） | DATA-D2 v2 扩展：DataProduct Python client（13 tests）+ DataJob/Dataset CRD（8 tests）— 2026-08-01；`evidence/DATA-D0-D8-D2-ACCEPTANCE-v2.md` |
| DATA-D3 v2 扩展 | 2026-08-01 | （本批） | DATA-D3 v2 扩展：QualityClient Python client（14 e2e tests）+ GE values checkpoints/tenantScoping 段 — 2026-08-01；`evidence/DATA-D0-D8-D3-ACCEPTANCE-v2.md` |
| DATA-D4 sync bridge | 2026-08-01 | （本批） | DATA-D4：LineageSyncClient Python client（13 e2e tests）+ datahub values lineage.bridge 段（marquez-to-datahub + DLQ + retry）— 2026-08-01；`evidence/DATA-D0-D8-D4-ACCEPTANCE.md` |
| DATA-D0-D8 D4+D5 | 2026-07-30 | `81955e76` | `evidence/DATA-D0-D8-D4-D5-ACCEPTANCE.md` |
| DATA-D0-D8 D6+D7+D8 | 2026-07-30 | `424e3045` | `evidence/DATA-D0-D8-D6-D7-D8-ACCEPTANCE.md` |
| PR-R1（refactor → main） | 2026-07-30 | `a00351c3` | CLAUDE.md v3.0 GA + refactor 视角合一 |

## 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-07-30 | 初版 v3.0 GA 收口（39 行） | 8/8 核心批次 + D0-D8 全部 Accepted |
| 2026-07-30 | v3.1 增量 + PR 治理（本文） | 与 git 状态同步；增加 v3.1 sub-batch / GA 收口 / PR 治理 3 个章节 |
| 2026-07-31 | P2 W2 → Accepted | dashboard / apphub / arch / copilot 4 域 · 99 endpoints · 93 tests · PR #12 `833a809d` |
| 2026-08-01 | P3-W6/W7 v3.1 增量 wave + G3/G7 → Accepted | D1 lineage e2e + G3 Outbox DDL + G7 SealedSecret runbook + DATA helm 真实化 + copilot 35/35 + A2A/LLM 真实；1500 tests / 0 failed |
| 2026-08-01 | G2 → Accepted | pre-commit 加固 + gitleaks 自定义规则 + 3 forbid 脚本（raw_sql / kafka_producer / external_secret）+ 20 tests；§13 第 3/4/12 条闭环 |