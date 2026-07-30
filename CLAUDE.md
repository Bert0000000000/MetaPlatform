# CLAUDE.md

> 本文件供 Claude Code 读取，提供项目上下文、架构约束与开发规范。
> **最近更新**：2026-07-30（**v3.0 GA 收口** — 8 个核心 Delivery Batch 全部 Accepted，§13 硬规则 1-13 全部闭环）
>
> **当前架构版本**：**v3.0（Plan D - Polyglot Microservice）GA**，v3.1 Data-Ready Baseline 同步中

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

## 提交顺序（强约束，沿用 production-readiness §10）

```
docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence
```

## 13 条硬规则（production-readiness §13，已 GA 收口）

| # | 硬规则 | 守门 | 收口证据 |
|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | oasdiff | `ga-001-openapi` CI job |
| 2 | PRD 没有 Requirement ID | 17 service contracts | `ga-002-requirement-ids` |
| 3 | **没有 tenant 上下文，不访问 repository** | `forbid_raw_sql` | `mate-platform/tenancy/db_filter.py` + 19 tests |
| 4 | **外部系统没有 ACL Client** | `forbid_bare_httpx` | `mate-clients/{kafka,redis,minio}` + BearerAuth |
| 5 | **Production profile 禁止 fallback** | `forbid_legacy_fallback` | SEC-IAM-01 startup guard |
| 6 | **静态检查失败不合并** | `pyright-strict` | ruff + pyright in `ga-006-static` |
| 7 | **契约或集成测试跳过不标记 Accepted** | `forbid_skip_tests` | 251 tests pass |
| 8 | **没有 K8s readiness + 回滚** | helm/kubeconform | `ga-008-helm` + default-deny NetworkPolicy |
| 9 | **没有审计、指标、trace** | OTel collector | tenant.id 注入 + 17 OTel tests |
| 10 | **所有状态以验收证据为准** | `require_evidence` | 8 ACCEPTANCE.md + 1 GA-ACCEPTANCE.md |
| 11 | **helm-docs 同步每个子 chart 的 README** | `helm-docs-sync` | `ga-011-helm-docs` |
| 12 | **Secret 不进 git** | gitleaks | `ga-012-secret-scan` + SealedSecret/ExternalSecret |
| 13 | **NetworkPolicy 缺失 = prod 不通过** | default-deny | `ga-013-networkpolicy` |

## 新 Codex / AI 会话接力

1. 切到对应批次的 worktree（`.worktrees/<batch>-01`），或基于 `main` 新建分支。
2. 整段复制粘贴对应 `ai-launch-prompt-batch*` 到对话开头。
3. 跑既有 pytest 套件确认基线（`infra/tests` + `mate-platform-backend/packages/*/tests`）。
4. 提交风格遵循 Conventional Commits。
5. PR 必须包含 ADR 引用 + operationId 引用 + 验收证据链接。
6. v3.1 增量工作（BUSINESS-SLICES / DATA-D0-D8）按 ADR-0014 / 未来 ADR-0016 推进。