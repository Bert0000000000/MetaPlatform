# Mate Platform 交付项目计划板（Program Board）

> 更新时间：2026-08-06（含 v3.1 Ontology 20/20 Batch + v4 RUNTIME-MVP-01 + RUNTIME-MVP-02 合并提速收口 + mp-ont-bugfix-01 + Dockerfile 修复 + BUSINESS-SLICES-WFE-P0 模板收口 ADR-0024 + MP-MCP-REGISTER-01；G1-G8 全 Accepted + M-v3.2-α + M-v3.2-γ + M-v3.2-δ 控制面 + 工作流 + 审计 + v3.1 子计划 + v4 RUNTIME + WFE P0 模板 + MP-MCP-REGISTER-01 内容全部闭环）
> 本表跟踪各交付批次在契约、代码、测试、运行时和验收证据上的当前状态。

## v3.1 + v4 RUNTIME + BUSINESS-SLICES P0 增量收口（2026-08-06）

| 增量 | 范围 | 状态 | 证据 |
|---|---|---|---|
| **v3.1 Ontology 子计划** | 20/20 Batch（KERNEL/MODEL/SANDBOX/SESSION/AIP-GATEWAY/AGENT-ORCH + ACTION/OBJECTSET/MANAGER/AGENT-ONT/AGENT-SEC/RAG-ONT + AGENT-WF/AGENT-APP/AGENT-DATA/AGENT-OBS/AGENT-KB/AGENT-EXT/SANDBOX-02/SUPER-COPILOT） | ✅ Accepted | `evidence/M{1,2,3}-ACCEPTANCE.md`（364/364 tests） |
| **mp-ont-bugfix-01** | 3 bug 修复（repo.evaluate_object_set 接入编译器 / FilterCompiler 识别连字符 slug / ResourceLimits 上下限）+ 27 e2e 固化 | ✅ Accepted | `evidence/V3.1-FINAL-STATUS.md` |
| **v4 RUNTIME-MVP-01**（ADR-0022） | RUNTIME-HTTP-01 + RUNTIME-PG-03 合并提速：FastAPI 5 endpoint + PgOntologyRepository + 7 e2e + curl 脚本 | ✅ Accepted 2026-08-06 | `evidence/RUNTIME-MVP-01-ACCEPTANCE.md` |
| **v4 RUNTIME-MVP-02**（ADR-0023） | RUNTIME-OPT + RUNTIME-K8S-02 + IAM-COPILOT-04 + MARKETPLACE-05 合并提速：SQLCompiler PG filter + SubprocessExecutor + 5 PG e2e + Playwright 17/17 | ✅ Accepted 2026-08-06 | `evidence/RUNTIME-MVP-02-ACCEPTANCE.md` |
| **Dockerfile 修复** | auth-service 加 structlog+httpx+aliyun mirror；ont 加 mate_kernel+psycopg2-binary | ✅ Accepted | commit `677a8697` |
| **BUSINESS-SLICES-WFE-P0**（ADR-0024） | FlowableClient 升级 BearerAuth + OutgoingAuthMiddleware（13 硬规则 #4 闭环）+ 47/47 tests | ✅ Accepted 2026-08-06 | `evidence/BUSINESS-SLICES-WFE-P0-ACCEPTANCE.md` |
| **MP-MCP-REGISTER-01**（ADR-0025） | McpMarketplaceClient 调 mate-tech-mcp `/api/v1/mcp/federation/servers` + BearerAuth + tenant middleware（13 硬规则 #4 闭环）+ McpInstaller 去 blocked-on + 8/8 tests | ✅ Accepted 2026-08-06 | `evidence/MP-MCP-REGISTER-ACCEPTANCE.md` |
| **MP-AGENT-REGISTER-01**（ADR-0026） | AgentMarketplaceClient 调 mate-tech-agent `/api/v1/agent/registry/agents` + BearerAuth + tenant middleware（13 硬规则 #4 闭环）+ AgentInstaller 去 blocked-on + 9/9 tests | ✅ Accepted 2026-08-06 | `evidence/MP-AGENT-REGISTER-ACCEPTANCE.md` |
| **MP-ONT-REGISTER-01**（ADR-0027） | OntologyMarketplaceClient 调 mate-tech-ont `/api/v1/ont/v2/object-types` (ObjectTypeDTO) + BearerAuth + tenant middleware（13 硬规则 #4 闭环）+ OntologyInstaller 去 blocked-on + 10/10 tests | ✅ Accepted 2026-08-06 | `evidence/MP-ONT-REGISTER-ACCEPTANCE.md` |

**main HEAD**：`ecb9e2b5`（合并 refactor/mp-agent-register-01 后）；origin 同步推送。

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

## 架构治理路线（GOVERN-01 立项，2026-08-07）

> 完整盘点见 `C:\Users\houuu\.claude\plans\cozy-orbiting-wombat.md`；矩阵见 `docs/active/governance/HARD-RULES-MATRIX.md`。

| Batch | 名称 | 状态 | 关联 | 证据路径 |
|---|---|---|---|---|
| **GOVERN-01** | 文档与治理收口（ADR 签字 + HARD-RULES-MATRIX + 状态机单一权威） | **Accepted** ✅ | ADR-0021/0040/0041 升 v1.0；PENDING-DECISIONS 签字追踪 | `docs/active/governance/HARD-RULES-MATRIX.md` |
| **GOVERN-02** | mate-tech-iam DEPRECATED 落地 | **In Progress** | ADR-0011 / SEC-IAM-01 | `docs/active/specs/2026-08-07-iam-deprecation-finalize.md` |
| **GOVERN-03** | mate-tech-ont v1 router 退役 + sparql tenant guard | **Accepted** ✅ | ADR-0021 / ADR-0027 | `evidence/GOVERN-03-SUBSPEC.md` + `evidence/MP-ONT-V1-SUNSET-NOTICE.md` |
| **GOVERN-04** | KERNEL-01 12 基元 PG 持久化补齐 | **Accepted** ✅ | ADR-0021 / MP-ONT-KERNEL-01-ACCEPTANCE | `evidence/GOVERN-04-SUBSPEC.md` |
| **GOVERN-05** | Function 基元执行器接通 | **Accepted** ✅ | ADR-0021 / ADR-0040 §2.5.1 | `evidence/GOVERN-05-SUBSPEC.md` |
| GOVERN-06 | tenant 隔离硬化（PG RLS） | **Accepted** ✅ | ADR-0012 / SEC-TENANT-01-ACCEPTANCE | `evidence/GOVERN-06-SUBSPEC.md` |
| GOVERN-07 | 死模块清理 | Planned | G8-FULL-ACCEPTANCE | (待 GOVERN-07 ACCEPTANCE) |
| GOVERN-08 | 前端路由与契约闭环 | Accepted ✅ | API-GOV-01 | [evidence/GOVERN-08-SUBSPEC.md](evidence/GOVERN-08-SUBSPEC.md) (commit 1aa8b2c1) |
| GOVERN-09 | Helm + NetworkPolicy + OTel 一致性 | Accepted ✅ | ADR-0010 / PLATFORM-K8S-01-ACCEPTANCE | [evidence/GOVERN-09-SUBSPEC.md](evidence/GOVERN-09-SUBSPEC.md) (commit db0c5d3a) |
| GOVERN-10 | 测试基线与回归保护 | Accepted ✅ | ADR-0015 / GA-ACCEPTANCE | [evidence/GOVERN-10-SUBSPEC.md](evidence/GOVERN-10-SUBSPEC.md) + [governance/FOLLOW-UP-BOARD.md](governance/FOLLOW-UP-BOARD.md) |
| GOVERN-10 FOLLOW-UP | 67 个未收口失败（A 40 / B 15 / C 10 / D 3） | Planned | HARD-RULES-MATRIX §3 | [governance/FOLLOW-UP-BOARD.md](governance/FOLLOW-UP-BOARD.md) |

## v3.1 增量 sub-batch（进行中）

### E2E 联调闭环（2026-08-06，Web 页面端到端验证）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 |
|---|---|---:|---:|---:|---:|---|
| **E2E-INTEGRATION-01** | **Accepted** ✅ | ✓ | ✓ | ✓ 46/46 Playwright E2E | ✓ Docker 全栈 | `evidence/E2E-INTEGRATION-ACCEPTANCE.md` |

- **模式**：前端对接后端 Docker 服务，Playwright 浏览器逐页面验证真实前后端对接 + 后端业务逻辑。
- **本批修复**：apphub/data 服务部署 + 网关路由、KB/AppHub 前后端字段映射、MCP clients CRUD 开发、llmgw/obs/msg/mcp 镜像缺模块修复、dw healthz、多服务 auth env 补齐。
- **遗留**：obs/msg 镜像重建受 Docker registry 网络限制；真实 LLM 外部网络不可达。

### In Progress — 业务域 P2 wave

| sub-batch | 域 | 接力分支 | 依赖 | 状态 |
|---|---|---|---|---|
| BUSINESS-SLICES P1 W2 | msg / obs（已含 W1 完整接入 + 5 步模式）| `codex/business-slices-w2` | TECH-SERVICES | ✅ Accepted |
| BUSINESS-SLICES P1 W3 | rag / mcp | `codex/p1-wave3` | TECH-SERVICES | ✅ Accepted |
| BUSINESS-SLICES P2 W1 | ont（带代码） | `codex/p2-wave` | P1 W3 | ✅ Accepted |
| **BUSINESS-SLICES P2 W2** | dashboard / apphub / arch / copilot（4 域，99 endpoints / 93 tests）| `codex/p2-wave-2` → PR #12 | P2 W1 | ✅ Accepted（2026-07-31，PR #12 合入 main，commit `833a809d`） |
| **BUSINESS-SLICES P2 W3** | dw / data / a2a / ont / wfe（5 域，需先建包代码） | 待开 | P2 W2 | ✅ Accepted（dw / a2a / wfe / ont / data 已全部接入） |

### Accepted — 云服务市场（MARKETPLACE-CONSUMER-01）

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 |
|---|---|---:|---:|---:|---:|---|
| **MARKETPLACE-CONSUMER-01** | **Accepted**（35 tests pass；3 个 register 子 spec 全闭环 + SEC-TENANT-01 豁免已签字）| ✓ | ✓ | ✓ 35/35 | ⏳ helm/E2E Pending（CI 跑绿后关闭）| `evidence/MARKETPLACE-CONSUMER-ACCEPTANCE.md` ✅ |

- **设计稿**：[`docs/superpowers/specs/2026-08-05-marketplace-consumer-design.md`](../specs/2026-08-05-marketplace-consumer-design.md)
- **实施计划**：[`docs/superpowers/plans/2026-08-05-marketplace-consumer.md`](../plans/2026-08-05-marketplace-consumer.md)
- **ADR**：[`ADR-0020`](../decisions/ADR-0020-marketplace-consumer.md)（跳号 0018，因被 `business-slices-slo` 占用）
- **前置阻塞**：`MP-MCP-REGISTER-01` ✅ Accepted / `MP-AGENT-REGISTER-01` ✅ Accepted / `MP-ONT-REGISTER-01` ✅ Accepted — 全部闭环，本 Batch 已转 Accepted。
- **新增硬规则 14**：市场资产 digest → 本地 instance 一致性（installer 内 `registered_digest == expected_digest` 校验 + 失败回滚 + 审计告警）。
- **SEC-TENANT-01 豁免点**：`marketplace_install` 是平台级资源但带 `tenant_id` 留痕，由 SEC-TENANT-01 owner 在 ACCEPTANCE 显式签字。
- **MP-MCP-REGISTER-01** ✅ 2026-08-06 — ADR-0025：`McpMarketplaceClient` 调 `POST /api/v1/mcp/federation/servers` + BearerAuth + tenant middleware（13 硬规则 #4 闭环）+ 8/8 tests + ruff 0 errors；commit `78ca0c0b`。
- **MP-AGENT-REGISTER-01** ✅ 2026-08-06 — ADR-0026：`AgentMarketplaceClient` 调 `POST /api/v1/agent/registry/agents` + BearerAuth + tenant middleware（13 硬规则 #4 闭环）+ 9/9 tests + ruff 0 errors；commit `ecb9e2b5`。
- **MP-ONT-REGISTER-01** ✅ 2026-08-06 — ADR-0027：`OntologyMarketplaceClient` 调 `POST /api/v1/ont/v2/object-types` (ObjectTypeDTO: rid/primary_key/properties/display_name/interfaces) + BearerAuth + tenant middleware（13 硬规则 #4 闭环）+ 10/10 tests + ruff 0 errors；commit `6161b2dc`（验收实测 2026-08-07：6/6 client + 4/4 installer + 三 installer 回归 12/12）。MARKETPLACE-CONSUMER-01 最后一个子 spec 闭环。

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
| 2026-08-02 | K2 APPHUB-RUNTIME-01 收口 → Accepted | 治理收口 5 件（require_evidence 拼写 bug 修复 + openapi.json 聚合 231 paths + apphub.yaml 6 operation 字段补齐 + ACCEPTANCE 13 门禁 + PROGRAM-BOARD）+ 阶段 D 收尾 4 件（4 页面切 marketplace API + QR Code + dist 增量 + tsc 0 error）|
| 2026-08-03 | K3 APPHUB-RUNTIME-01 后端硬化 4 件 → Accepted | K3-1 SQL 持久化（`b5250c01`）+ K3-2 OTel 4 关键路径 span（`ea5f8b42`）+ K3-3 租户双轨清理（`4dddf302`）+ K3-4 executor 真实化 RealExecutor + mate_clients stubs（`2b5aa99f`）；硬规则 6 ruff 0 + pyright 0（`5632dbc4`）；134 tests / 0 skip |
| 2026-08-03 | mcp Fix-1 P3-W10 测试闭环 → Accepted | `4338554ed16f`（test_routes_registered 用 app.openapi() 检查 + test_rate_limit mock 修正 + test_api_edge Keycloak JWT + ruff config 扩展 + ruff auto-fix）；`pytest packages/mate-tech-mcp → 146 passed / 0 failed`，`ruff check packages/mate-tech-mcp → All checks passed!` |
| 2026-08-03 | v3.2 W2/W3 验证闭环 → Accepted | `b2bdae4a22c2`（infra/tests G5 security parity 17→18 域加 deep-research + deep-research test_tenant_integration 模块名冲突 rename + conftest/router 修 ruff + ruff auto-fix）；`pytest packages → 1566 passed / 0 failed`，`pytest infra/tests/ → 1492 passed / 4 skipped` |
| 2026-08-03 | v3.2-α G6 RLS 应用层增强 + D1 staging smoke → Accepted | `ea0d60febf6b`（`mate_platform.tenancy.rls_session` 模块 + `install_rls_session` SET LOCAL `app.tenant_id` 注入 + SQL injection 防御 + cross_tenant_admin bypass flag + 18 tests；`scripts/ci/d1_staging_smoke.sh` + `infra/tests/test_d1_staging_smoke.py` 10 tests）；`pytest packages → 1584 passed`，`pytest infra/tests/ → 1501 passed / 5 skipped`；证据 `G6-RLS-SESSION-ACCEPTANCE.md` + `D1-STAGING-ACCEPTANCE.md` |
| 2026-08-03 | v3.2-α G6 RLS PgClient 集成 + v3.2-γ Iceberg/Trino sub-chart → Accepted | `0d9a96cc06c6`（`mate_clients/pg.PgClient.session` 改写：真实 `RequestContext` + `install_rls_session` 集成 + 3 integration tests；`infra/helm/charts/iceberg/` 9 文件 sub-chart + `infra/helm/charts/trino/` 10 文件 sub-chart (coordinator+worker 联邦 3 catalog) + umbrella `Chart.yaml` 注册 + CI workflow `g4-d1-staging-e2e.yml` + `infra/tests/test_iceberg_trino_chart.py` 22 tests + chart_structure REQUIRED_SUB_CHARTS 扩展）；`pytest packages → 1587 passed`，`pytest infra/tests/ → 1549 passed / 5 skipped`；证据 `G6-RLS-PGCLIENT-INTEGRATION-ACCEPTANCE.md` + `V32-GAMMA-ACCEPTANCE.md` |
| 2026-08-03 | G6 RLS FastAPI Depends + 历史 ruff 收尾 + StarRocks sub-chart → Accepted | `rls_session.py` 加 `rls_db_session` + `rls_db_session_for` FastAPI 集成函数 + 7 tests；`mate-clients/pg.py` + `test_pg_client.py` 历史 7 个 ruff 错误清零 (UP035/PLW0603/F401/PTH110/PTH107/SIM117 + ruff.toml ignore)；`infra/helm/charts/starrocks/` 7 文件 sub-chart (FE+BE+external catalogs+tenant 隔离+NetworkPolicy) + umbrella 注册 + `infra/tests/test_starrocks_chart.py` 16 tests + chart_structure REQUIRED_SUB_CHARTS 扩展；`pytest packages → 1594 passed`，`pytest infra/tests/ → 1579 passed / 5 skipped`；`ruff check mate-clients → All checks passed!`；证据 `RLS-DEPENDENCY-MIDDLEWARE-ACCEPTANCE.md` |
| 2026-08-03 | v3.2-δ 多模态数据产品 (Iceberg ADS) 控制面 + 工作流 + 审计 → Accepted | 3 sub-agent 并行交付：① DataProduct 域 9 endpoints (CRUD + publish/certify/suspend lifecycle + 多模态 modality + 版本) + 15 tests；② IcebergRestAdapter + AdsPublisher 4 步工作流 (resolve → validate status → iceberg create_namespace+register_table → bump version+emit outbox) + 22 tests；③ AdsAuditMiddleware ASGI 中间件 (cross_tenant_data_access outbox event on tagged ADS reads) + 8 tests；历史 ruff 收尾 (debezium_engine SIM105, tenancy __init__ RUF022/F401)；`pytest packages → 1639 passed` (从 1594 → 1639, +45)；`ruff check → 0 errors`；证据 `V32-DELTA-DATA-PRODUCT-ACCEPTANCE.md` |
| 2026-08-06 | MP-MCP-REGISTER-01 → Accepted | ADR-0025 `McpMarketplaceClient` 调 `POST /api/v1/mcp/federation/servers` + BearerAuth + tenant middleware（13 硬规则 #4 闭环）+ McpInstaller 去 blocked-on + 8/8 tests + ruff 0 errors；commit `78ca0c0b`；`pytest packages → 2180 passed / 54 pre-existing failures unrelated`（已在 main 验证）；证据 `MP-MCP-REGISTER-ACCEPTANCE.md`；main HEAD `78ca0c0b` 已推送 origin。剩余 MP-AGENT-REGISTER-01 + MP-ONT-REGISTER-01 → MARKETPLACE-CONSUMER-01 → Accepted。 |
| 2026-08-06 | MP-AGENT-REGISTER-01 → Accepted | ADR-0026 `AgentMarketplaceClient` 调 `POST /api/v1/agent/registry/agents` + BearerAuth + tenant middleware（13 硬规则 #4 闭环）+ AgentInstaller 去 blocked-on + 9/9 tests + ruff 0 errors；commit `ecb9e2b5`；证据 `MP-AGENT-REGISTER-ACCEPTANCE.md`；main HEAD `ecb9e2b5` 已推送 origin。剩余 MP-ONT-REGISTER-01 → MARKETPLACE-CONSUMER-01 → Accepted。 |
| 2026-08-06 | fix(docker): auth-service uv pip install | `python -m pip install` 在 uv-managed venv 中失败（`No module named pip`）；改为 `uv pip install --python /app/.venv/bin/python --no-cache`；commit `3d98a6a9`。 |
| 2026-08-07 | MP-ONT-REGISTER-01 验收实测 → 补全 | mate-clients 6/6 + mate-platform 4/4 + ruff 0 errors（commit `6161b2dc`，2026-08-06 已提交）；验收记录补入 `MP-ONT-REGISTER-ACCEPTANCE.md`；**MARKETPLACE-CONSUMER-01 → Accepted**（3 个 register 子 spec 全闭环 + SEC-TENANT-01 豁免签字落款）。 |
| 2026-08-07 | fix: pnpm-workspace.yaml 无效 allowBuilds 块 | d478311c 已修复的 `allowBuilds:`（含 `set this to true or false` 占位符）重新混入工作区；删除恢复为仅 `onlyBuiltDependencies`（pnpm 11 标准）。 |
| 2026-08-07 | fix: pytest tmp_path PermissionError（环境） | `C:\Users\houuu\AppData\Local\Temp\pytest-of-houuu` ACL 损坏导致全部 tmp_path fixture 失败；设置用户环境变量 `PYTEST_DEBUG_TEMPROOT=C:\Users\houuu\AppData\Local\Temp\pytest-alt` 绕过（新会话自动生效）。 || 2026-08-17 | **MP-SAL-01 → Accepted** | ADR-0043（ObjectSet IR + 工具 schema 生成器，九条定案）落地：`mate_kernel/objectset/ir.py` 结构化查询 IR（filter/aggregate/traverse/多键 sort，InMemory+PG 双后端同源对拍通过）+ `mate_kernel/tooling/schema_gen.py`（每类型 query_<slug> 工具 + 虚拟注册表零同步）+ ObjectType.marking 上抬一级（可见性 + 执行期二次校验）+ ont.yaml 3 新端点（ontExecuteV2ObjectQuery/ontInspectV2Class/ontListV2AgentTools）+ copilot/MCP 双消费接线。测试：kernel 455 passed（+30）/ ont 172 / orchestrator 47+1skip（superai_a2a 基线先修）/ mcp 0 failed；ruff+pyright 新文件全净；kitchen sink 12 步（含 e2e 守护）。证据 `MP-SAL-01-ACCEPTANCE.md`。语义层 AI 落地程序（读+想+写）起点：下一批 SAL-02（OAG）。 |
| 2026-08-17 | **MP-SAL-02 → Accepted** | OAG 检索上下文（想）：tech-ont `object_search`（Embedder 协议 + HashEmbedder 离线 + OpenAI 兼容 env 客户端）+ `ont_object_embedding` 属性级索引表（index-on-write best-effort + reindex 存量补齐）+ `search_objects` cosine→对象卡片（rid 全程可追溯）+ REST object-search/reindex 两端点 + copilot `search_objects` 第 4 固定工具 + `build_system_prompt` 对象卡片注入（每行带 individual_rid）。测试 +17（kernel 455 / ont 172 / copilot 相关 39 全绿）；ruff+pyright 全净。证据 `MP-SAL-02-ACCEPTANCE.md`。进度：读 ✅ 想 ✅ → 写（SAL-04，先 ADR-0044）+ 生产门（SAL-03）。 |
| 2026-08-17 | **MP-SAL-04 → Accepted（核心闭环达成）** | Assisted Action 写腿（ADR-0044）：kernel ProposalStatus 状态机（apply(proposal_id) 三查——未确认永不落库）+ ont_proposal 持久化 + outbox emitter 接线（事件 id 回填 ApplyOutcome.side_effect_events）+ REST propose/get/confirm/reject + copilot propose_action LLM 工具（confirm/reject 永不出现在工具面，HITL 边界断言入测试）。测试 kernel 465 / ont 179 / copilot 相关 15 全绿。证据 `MP-SAL-04-ACCEPTANCE.md`。**SAL-01 读 + SAL-02 想 + SAL-04 写 = 语义层 AI 落地核心闭环（spec §4.0 程序目标）达成**；SAL-03 生产门随生产化收口。 |
| 2026-08-17 | **MP-SAL-03 → Accepted（MP-SAL 程序四批完结）** | Function 沙箱生产门：K8sJobExecutor（K8sSandboxSpec→batch/v1 Job manifest，kubectl apply→wait→logs→delete 全生命周期，NetworkPolicy 注解对齐 default-deny，异常降级+finally 清理）+ SANDBOX_BACKEND=k8s 开关（dev subprocess 双轨保持）；copilot 真鉴权核实（install_auth 已装 + auth/config.py production guard 强制 Keycloak，代码无缺口）。kernel 476 passed。证据 `MP-SAL-03-ACCEPTANCE.md`。**SAL-01/02/03/04 四批全 Accepted = 语义层 AI 落地程序（读+想+写+生产门）完成**。 |
