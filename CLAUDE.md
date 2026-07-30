# CLAUDE.md

> 本文件供 Claude Code 读取，提供项目上下文、架构约束与开发规范。
> **最近更新**：2026-07-30（5 个 Delivery Batch 进入 Accepted：API-GOV-01、ARCH-CORE-01、PLATFORM-K8S-01、SEC-IAM-01、SEC-TENANT-01）；上一版 2026-07-29（新增 Cowork ↔ Claude Code 交接约定）
>
> **当前架构版本**：**v3.0（Plan D - Polyglot Microservice）**，v3.1 Data-Ready Baseline 同步中（详见附录 A）
>
> **配套文档（实施版）**：
> - 主架构（实施版）：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` ⭐ THE ONE DOC
> - 技术栈定稿：`docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md`
> - 交付版本计划：`docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md`
> - 历史决策（已归档）：`docs/active/specs/2026-07-27-mate-platform-technical-architecture.md`

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

## 当前 Delivery Batch 状态（2026-07-30）

| Batch | 状态 | Commit | 关键 ADR | AI Launch Prompt |
|---|---|---|---|---|
| API-GOV-01 | **Accepted** | 1fa521fd | — | `ai-launch-prompt.md`（batch A） |
| ARCH-CORE-01 | **Accepted** | eeaab5c5 | — | `ai-launch-prompt-batchB.md` |
| PLATFORM-K8S-01 | **Accepted** | 4d0b73d6 | ADR-0010 | `2026-07-30-ai-launch-prompt-batchC-platform-k8s.md` |
| SEC-IAM-01 | **Accepted** | 4d3d894e | ADR-0011 | `2026-07-30-ai-launch-prompt-batchD-sec-iam-01.md` |
| SEC-TENANT-01 | **Accepted** | 026ce4a8 | ADR-0012 | `2026-07-30-ai-launch-prompt-batchE-sec-tenant-01.md` |
| **PLATFORM-EVENT-01** | **Not Started** | — | ADR-0013（待写）| `2026-07-30-ai-launch-prompt-batchF-platform-event-01.md` |
| SEC-TENANT-01 → TECH-SERVICES → BUSINESS-SLICES → DATA-D0-D8 → GA-ACCEPTANCE | Not Started | — | — | — |

> 详细 13 门禁证据见 `docs/active/delivery/evidence/<BATCH>-ACCEPTANCE.md`。
> 全部批次跟踪表见 `docs/active/delivery/PROGRAM-BOARD.md`。

## 已落地的基础设施

### 运行时（PLATFORM-K8S-01）
- `infra/helm/` umbrella chart + 4 sub-charts（otel-collector / keycloak /
  network-policies / service-templates）。
- 6 套环境 values（local / staging / production 等）。
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

1. Swagger 没有接口，不写 route。
2. PRD 没有 Requirement ID，不进入开发。
3. **没有 tenant 上下文，不访问 repository**（SEC-TENANT-01 机械执行）。
4. 外部系统没有 ACL Client，业务代码不直连。
5. **Production profile 禁止 fake / mock / memory fallback**（SEC-IAM-01 拒绝启动）。
6. 静态检查失败不合并。
7. 契约或集成测试跳过不标记 Accepted。
8. 没有 K8s readiness 和回滚不算生产完成（PLATFORM-K8S-01 + NetworkPolicy）。
9. 没有审计、指标和 trace 不算业务闭环（OTel collector + tenant_id 注入）。
10. 所有状态以验收证据为准。
11. helm-docs 同步每个子 chart 的 README。
12. Secret 不进 git（SealedSecret / ExternalSecret）。
13. NetworkPolicy 缺失等同于 prod 不通过（PLATFORM-K8S-01 default-deny）。

## 新 Codex / AI 会话接力

1. 切到对应批次的 worktree（`.worktrees/<batch>-01`），或基于 `main` 新建分支。
2. 整段复制粘贴对应 `ai-launch-prompt-batch*` 到对话开头。
3. 跑既有 pytest 套件确认基线（`infra/tests` + `mate-platform-backend/packages/*/tests`）。
4. 提交风格遵循 Conventional Commits。
5. PR 必须包含 ADR 引用 + operationId 引用 + 验收证据链接。