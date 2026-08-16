# CLAUDE.md

> 本文件供 Claude Code 读取，提供项目上下文、架构约束与开发规范。
> **最近更新**：2026-08-17（**MP-COMP-01 收口（cordis 范式自建组合内核）** — ADR-0042 引原理不引组件：`mate_platform/composition` 内核 674 行零依赖（revertible effects + reactive coeffects + 惰性 fiber），四条形式化不变量 I1-I4 共 19 tests 绿；orchestrator 能力反应式试点（capability fiber + dispatch overlay + lifespan，裸 TestClient 回退逐字节一致），9 试点 tests；board §6.5 + `evidence/MP-COMP-01-ACCEPTANCE.md`）；上一版 2026-08-10（GOVERN-10 收口）
>
> **当前架构版本**：**v3.0（Plan D - Polyglot Microservice）GA**；**v3.1** Ontology / 数字员工 / SuperAI 子计划 20/20 Batch Accepted；**v4** RUNTIME 路线 5/5 Batch Accepted
>
> **架构治理路线（2026-08-10 GOVERN-10 完结）**：`docs/active/governance/HARD-RULES-MATRIX.md` + `docs/active/governance/FOLLOW-UP-BOARD.md` + 计划文件 `cozy-orbiting-wombat.md`。**10/10 治理批次（GOVERN-01~10）全部完结**，13 硬规则状态 9 ✅ / 2 🟡 / 0 ⏳ / 0 🔧。67 个未收口测试失败入 FOLLOW-UP-BOARD（A: OpenAPI parity 40 / B: MCP PG 15 / C: copilot 10 / D: llmgw 3）。详见 §"13 硬规则 × CI 矩阵"。

## v3.0 GA 状态

**8 / 8 核心 Delivery Batch 已 Accepted**。§13 硬规则 1-13 通过 pre-commit 钩子 +
CI jobs + 测试覆盖三层保障闭环。251 / 251 tests pass。

### 已完成批次

| Batch | Commit | 关键能力 |
|---|---|---|
| API-GOV-01 | 1fa521fd | OpenAPI 单一契约源 |
| ARCH-CORE-01 | eeaab5c5 | mate-kernel / mate-platform / mate-clients / app-* 四层结构 |
| PLATFORM-K8S-01 | 4d0b73d6 | K8s / Helm / Keycloak / OTel / NetworkPolicy |
| SEC-IAM-01 | 4d3d894e | Keycloak JWT 验证 + 服务身份 |
| SEC-TENANT-01 | 026ce4a8 | 5 层隔离 + cross_tenant_admin |
| PLATFORM-EVENT-01 | 95b35e43 | Outbox + 幂等消费者 + DLQ |
| TECH-SERVICES | 7fa52dc8 | 17 域 5 步接入 + canonical reference |
| GA-ACCEPTANCE | 87f589be | 13 硬规则收口 + pre-commit + GA CI |

### 后续增量（v3.1）

- **BUSINESS-SLICES**：17 域 P0/P1/P2 接入（按 ADR-0014 checklist）。
- **DATA-D0-D8**：数据平台（CDC / lineage / quality / catalog）。

## 配套文档（实施版）

- 主架构（实施版）：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` ⭐ THE ONE DOC
- 技术栈定稿：`docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md`
- 交付版本计划：`docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md`
- 13 硬规则设计：`docs/active/specs/2026-07-30-backend-production-readiness-design.md`
- 8 个 ACCEPTANCE.md：`docs/active/delivery/evidence/`
- 9 个 ADR（决策记录）：`docs/active/decisions/`
- 6 个 AI Launch Prompt（接力）：`docs/active/specs/2026-07-30-ai-launch-prompt-batch*`
- 1 per-app 集成 checklist：`docs/active/specs/2026-07-30-per-app-integration-checklist.md`
- 5 个 CI hooks 脚本：`scripts/ci/forbid_*.py` + `require_evidence.py`
- 6 个 GitHub workflows：`.github/workflows/`
- 1 个 pre-commit 配置：`.pre-commit-config.yaml`

## 项目概述

**Mate Platform** 是基于 Ontology 本体引擎 + Polyglot Microservice 的企业级 AI 平台。

### 核心能力
- **Ontology 本体引擎**：统一语义建模与推理
- **低代码应用构建**：BPMN 审批流（Flowable 8.0）+ AI Agent 编排流（LangGraph）
- **数字员工**：AI 驱动的自动化
- **企业级 RAG**：RAGFlow + LightRAG + LLM Gateway
- **MCP / A2A 协议**：对接外部 AI 工具与 Agent 系统

## v3.0 架构基线（一句话）

**Python 主后端（业务）+ Java 外部引擎（Keycloak/Flowable/Drools 作为成熟产品）+ Python AI 服务 + 完整 docker-compose 基础设施栈。**

### 服务全景（30+ 服务）

> 详见 `docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` 的服务矩阵。

## 当前 Delivery Batch 接力（refactor/monorepo-shrink-phase-2 视角）

| Batch | 状态 | Commit | 关键 ADR | AI Launch Prompt |
|---|---|---|---|---|
| API-GOV-01 | **Accepted** | 1fa521fd | — | `ai-launch-prompt.md`（batch A） |
| ARCH-CORE-01 | **Accepted** | eeaab5c5 | — | `ai-launch-prompt-batchB.md` |
| PLATFORM-K8S-01 | **Accepted** | 4d0b73d6 | ADR-0010 | `2026-07-30-ai-launch-prompt-batchC-platform-k8s.md` |
| SEC-IAM-01 | **Accepted** | 4d3d894e | ADR-0011 | `2026-07-30-ai-launch-prompt-batchD-sec-iam-01.md` |
| SEC-TENANT-01 | **Accepted** | 026ce4a8 | ADR-0012 | `2026-07-30-ai-launch-prompt-batchE-sec-tenant-01.md` |
| PLATFORM-EVENT-01 | **Accepted** | 95b35e43 | ADR-0013 | `2026-07-30-ai-launch-prompt-batchF-platform-event-01.md` |
| TECH-SERVICES | **Accepted** | 7fa52dc8 | ADR-0014 | `2026-07-30-ai-launch-prompt-batchG-tech-services.md` |
| GA-ACCEPTANCE | **Accepted** | 87f589be | ADR-0015 | `2026-07-30-ai-launch-prompt-batchH-ga-acceptance.md` |
| BUSINESS-SLICES | In Progress | — | ADR-0016 | `2026-07-30-ai-launch-prompt-batchI-business-slices.md` |
| DATA-D0-D8 | In Progress | — | ADR-0017 | `2026-07-30-ai-launch-prompt-batchJ-data-d0-d8.md` |

> 详细 13 门禁证据见 `docs/active/delivery/evidence/<BATCH>-ACCEPTANCE.md`。
> 全部批次跟踪表见 `docs/active/delivery/PROGRAM-BOARD.md`。

## 已落地的基础设施（PLATFORM-K8S-01 / SEC-IAM-01 / SEC-TENANT-01）

### 运行时（PLATFORM-K8S-01）
- `infra/helm/` umbrella chart + 4 sub-charts（otel-collector / keycloak /
  network-policies / service-templates）。
- 5 套环境 values（默认 `values.yaml` + `values-local.yaml` + `values-staging.yaml` + `values-production.yaml` + `.helmignore`）。GOVERN-09 修订原文「6 套」错记。
- `infra/argocd/` ApplicationSet + app-of-apps + AppProject。
- `.github/workflows/platform-k8s-ci.yml` 5 jobs 流水线。
- `infra/tests/` 105 pytest 静态校验。

### 身份（SEC-IAM-01）
- `mate-platform/auth/` 7 模块：config / jwks / verifier / identity /
  tenant / middleware / __init__。
- `mate-clients/security/` 3 模块：BearerAuth / OutgoingAuthMiddleware /
  __init__。
- `tests/test_sec_iam_01.py` 29 tests pass。
- 旧 `mate-tech-iam` 标 deprecated（生产 profile 拒绝加载）。
- OpenAPI securityScheme 升级：bearerAuth + tenantHeader + oidcScopes。

### 租户（SEC-TENANT-01）
- `mate-platform/tenancy/` 4 模块：repository / guards / db_filter / audit。
- `mate-platform/messaging/kafka_tenant.py`：topic 命名约定 +
  assert_message_tenant 消费端校验。
- `mate-clients/redis/keys.py` + `minio/buckets.py`：命名空间隔离。
- `tests/test_sec_tenant_01.py` 54 tests pass（含 12 跨租户 negative）。

## 提交顺序（强约束，沿用 production-readiness §10）

```
docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence
```

## 13 条硬规则（production-readiness §13）

> **语义对齐（GOVERN-01 治理收口，2026-08-07）**：源文档 `docs/superpowers/specs/2026-07-30-backend-production-readiness-design.md:1-3` 自标「已完成方案讨论，待书面评审」。本项目"GA 收口"指的是 **「规则全部实现 + CI gate 在跑 + 证据档 ACCEPTANCE」**，而不是「设计文档本身书面评审签字」。两套语义并存；下游 Codex 接力以 **CI 全绿 + ACCEPTANCE.md 落地** 为准。

完整对位矩阵（13 × 9 workflow × owner × 状态）见 `docs/active/governance/HARD-RULES-MATRIX.md`。

| # | 硬规则 | 守门 | 收口证据 | 状态 |
|---|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | oasdiff | `ga-001-openapi` CI job | ✅ |
| 2 | PRD 没有 Requirement ID | 17 service contracts | `ga-002-requirement-ids` | ✅ |
| 3 | **没有 tenant 上下文，不访问 repository** | `forbid_raw_sql` | `mate-platform/tenancy/db_filter.py` + 19 tests | 🟡 GOVERN-06 硬化 |
| 4 | **外部系统没有 ACL Client** | `forbid_bare_httpx` | `mate-clients/{kafka,redis,minio}` + BearerAuth | ✅ |
| 5 | **Production profile 禁止 fallback** | `forbid_legacy_fallback` | SEC-IAM-01 startup guard | ✅ |
| 6 | **静态检查失败不合并** | `pyright-strict` | ruff + pyright in `ga-006-static` | ✅ |
| 7 | **契约或集成测试跳过不标记 Accepted** | `forbid_skip_tests` | 251 tests pass | 🟡 GOVERN-10 拆 job |
| 8 | **没有 K8s readiness + 回滚** | helm/kubeconform | `ga-008-helm` + default-deny NetworkPolicy | ✅ |
| 9 | **没有审计、指标、trace** | OTel collector | tenant.id 注入 + 17 OTel tests | 🟡 GOVERN-09 compose≠Helm |
| 10 | **所有状态以验收证据为准** | `require_evidence` | 8 ACCEPTANCE.md + 1 GA-ACCEPTANCE.md | 🟡 GOVERN-01/-10 收口 |
| 11 | **helm-docs 同步每个子 chart 的 README** | `helm-docs-sync` | `ga-011-helm-docs` | ✅ |
| 12 | **Secret 不进 git** | gitleaks | `ga-012-secret-scan` + SealedSecret/ExternalSecret | ✅ |
| 13 | **NetworkPolicy 缺失 = prod 不通过** | default-deny | `ga-013-networkpolicy` | 🟡 GOVERN-09 21 Python 服务未覆盖 |

## 新 Codex / AI 会话接力

1. 切到对应批次的 worktree（`.worktrees/<batch>-01`），或基于 `main` 新建分支。
2. 整段复制粘贴对应 `ai-launch-prompt-batch*` 到对话开头。
3. 跑既有 pytest 套件确认基线（`infra/tests` + `mate-platform-backend/packages/*/tests`）。
4. 提交风格遵循 Conventional Commits。
5. PR 必须包含 ADR 引用 + operationId 引用 + 验收证据链接。
6. v3.1 增量工作（BUSINESS-SLICES / DATA-D0-D8）按 ADR-0016 / ADR-0017 推进。

## v3.1 Ontology / 数字员工 / SuperAI 子计划（2026-08-06 启动 / 同日 20/20 收口）

> **总览**：**20 Batch / 38 周 ≈ 9 个月到 GA-Ready**。AI 不直连业务表，通过 `ActionType.apply` / `Function` 访问 Ontology；用户确认后落库；多用户多 Agent 全程双层沙箱隔离。
>
> **收口状态**：**M1+M2+M3 = 20/20 Batch Accepted · 364/364 tests pass · 端到端 kitchen sink 11 步通过**。
>
> **自建原则（v0.4 强约束）**：不引入 Palantir 任何官方开源组件（foundry-platform-python/ts、foundry-dev-tools、Magritte、Conjure）。所有 Ontology 服务端能力、SDK 形态、协议描述符全部自建。客户端统一用 OpenAPI Generator 封装在 `mate-clients/sdk/`。

### 三大顶层原理

1. **Operational Layer** —— 本体 = 组织级操作层（Palantir overview 原文）
2. **Digital Twin = Semantics + Kinetics** —— 业务由不可变类型 + 可变行为构成
3. **AI 穿透本体** —— AI 输出 = proposal，用户确认后由 ActionType 落库

### 12 Kernel 基元（MP-ONT-KERNEL-01 交付，ADR-0021 冻结）

| 层 | 基元 |
|---|---|
| 标识 | `ClassRef` / `Version` |
| 类型 | `Property` / `ObjectType` / `LinkType` / `ActionType` / `Interface` |
| 实例 | `Individual` / `LinkInstance` |
| 推理 | `Axiom` / `Function` |
| 查询 | `ObjectSet` |

`rid` 形如 `ont.<tenant>.<kind>.<slug>.<version>`。

### 7 + 1 类数字员工

Ontology / Workflow / App / Data Product / OBS / Security / Knowledge Library + **SuperAI (COPILOT)** 编排平面。**7 + N**：7 内置共享 + Marketplace 第三方订阅。

### 三层沙箱（用户提的"必须沙箱"已对位）

- **Session Sandbox**（用户级，决策 ADR-0041）—— L2 容器，每用户每会话独占
- **Function Sandbox**（调用级，决策 ADR-0040）—— L2 容器（K8s Job），每次调用独立
- **第三方 Sandbox** —— L3 MicroVM（Firecracker），Marketplace 强制

### 12 决策点 + 3 锁死问题（已收口）

A1=b (RAG+规则+偶发微调)｜A2=7+N｜A3=新建 orchestrator｜A4=混合
B1=Function L2+第三方 L3｜B2=会话级短期 token｜B3=每次 ≥1 HITL｜B4=SANDBOX-01 进 M1
C1=可配置（30min/24h）｜C2=opt-in｜C3=默认 discard 可 opt-in 7d｜C4=同步
L1=直接迁移 v2｜L2=K8s Job/Pod（最佳实践）｜L3=PG 表

### Batch 路线（依赖图）

```
M1 (8 周, 6 Batch)         M2 (10 周, 6 Batch)         M3 (12 周, 8 Batch)
─────────────────────      ──────────────────────      ─────────────────────
KERNEL-01        ┐         ACTION-03          ┐         AGENT-WF-01
MODEL-02         │         OBJECTSET-04       │         AGENT-APP-01
SANDBOX-01       │         MANAGER-05         │         AGENT-DATA-01
SESSION-01       │         AGENT-ONT-01       │         AGENT-OBS-01
AIP-GATEWAY-01   │         AGENT-SEC-01       │         AGENT-KB-01
AGENT-ORCH-01    ┘         RAG-ONT-01         ┘         AGENT-EXT-01
                                                        SANDBOX-02
                                                        SUPER-COPILOT-01
```

### 配套文档

- 蓝图：`docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4
- ADR-0021（Kernel 12 基元）：`docs/active/decisions/ADR-0021-kernel-12-primitives.md`
- ADR-0040（沙箱架构）：`docs/active/decisions/ADR-0040-sandbox-architecture.md`
- ADR-0041（Session Sandbox）：`docs/active/decisions/ADR-0041-session-sandbox.md`
- ADR-0042（组合内核 · cordis 范式自建，MP-COMP-01）：`docs/active/decisions/ADR-0042-composition-kernel.md`（内核 `mate_platform/composition`，orchestrator 能力反应式试点）
- 决策纪要：`docs/active/decisions/PENDING-DECISIONS.md`
- 评审记录：`docs/active/decisions/ADR-REVIEW-2026-08-06.md`
- 任务板：`docs/active/delivery/V31-ONTOLOGY-BOARD.md`

### 接力指引（v3.1 Ontology）

1. 切到 `.worktrees/mp-ont-kernel-01`（已就绪，分支 `refactor/mp-ont-kernel-01`，基于 main）
2. 起 M1 启动包：12 基元 Protocol/dataclass 骨架 + 60 tests 列表
3. 提交风格遵循 Conventional Commits；PR 引用 ADR-0021 + operationId + `MP-ONT-KERNEL-01-ACCEPTANCE.md`
4. v0.5 任务：补抓 Palantir 官方 7 个核心页正文，替换"可证伪"行
